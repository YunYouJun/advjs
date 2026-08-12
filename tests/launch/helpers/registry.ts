import { Buffer } from 'node:buffer'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, join } from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { readTarEntries } from '../../../scripts/release/package-manifest.mjs'

const execFileAsync = promisify(execFile)

interface PackedManifestItem {
  integrity: string
  name: string
  tarball: string
  version: string
}

interface PackedManifest {
  packages: PackedManifestItem[]
}

async function requestBody(request: import('node:http').IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request)
    chunks.push(Buffer.from(chunk))
  return chunks.length ? Buffer.concat(chunks) : undefined
}

export function launchRegistryEnvironment(registryUrl: string, temporaryRoot: string) {
  const environment = {
    ...process.env,
    CI: '1',
    npm_config_audit: 'false',
    npm_config_cache: join(temporaryRoot, 'npm-cache'),
    npm_config_fund: 'false',
    npm_config_registry: registryUrl,
    npm_config_update_notifier: 'false',
    pnpm_config_store_dir: join(temporaryRoot, 'pnpm-store'),
  }
  delete environment.NODE_PATH
  delete environment.PNPM_HOME
  return environment
}

export async function runLaunchCommand(command: string, args: string[], cwd: string, registryUrl: string, temporaryRoot: string, environment: NodeJS.ProcessEnv = {}) {
  return await execFileAsync(command, args, {
    cwd,
    env: { ...launchRegistryEnvironment(registryUrl, temporaryRoot), ...environment },
    maxBuffer: 20 * 1024 * 1024,
    timeout: 180_000,
  })
}

export async function createLaunchRegistry(packageManifest: PackedManifest, tarballDirectory: string) {
  const metadata = new Map<string, { item: PackedManifestItem, packedPackage: Record<string, unknown>, tarballPath: string }>()
  const tarballs = new Map<string, Buffer>()
  const localRequests: string[] = []
  let url = ''

  for (const item of packageManifest.packages) {
    const tarball = await readFile(join(tarballDirectory, item.tarball))
    const entries = readTarEntries(tarball)
    const packageJson = entries.get('package/package.json')
    if (!packageJson)
      throw new Error(`${item.name} tarball is missing package.json`)
    const packedPackage = JSON.parse(packageJson.toString('utf8')) as Record<string, unknown>
    const tarballPath = `/${encodeURIComponent(item.name)}/-/${basename(item.tarball)}`
    metadata.set(item.name, { item, packedPackage, tarballPath })
    tarballs.set(tarballPath, tarball)
  }

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://registry.local')
      const localTarball = tarballs.get(requestUrl.pathname)
      if (localTarball) {
        localRequests.push(requestUrl.pathname)
        response.writeHead(200, { 'content-length': localTarball.length, 'content-type': 'application/octet-stream' })
        response.end(localTarball)
        return
      }

      const packageName = decodeURIComponent(requestUrl.pathname.slice(1))
      const localPackage = metadata.get(packageName)
      if (localPackage && request.method === 'GET') {
        localRequests.push(packageName)
        const { item, packedPackage, tarballPath } = localPackage
        const publishedAt = '2026-08-11T00:00:00.000Z'
        const body = Buffer.from(JSON.stringify({
          '_id': packageName,
          'dist-tags': { latest: item.version },
          'name': packageName,
          'time': {
            [item.version]: publishedAt,
            created: publishedAt,
            modified: publishedAt,
          },
          'versions': {
            [item.version]: {
              ...packedPackage,
              dist: {
                integrity: item.integrity,
                shasum: '',
                tarball: `${url}${tarballPath}`,
              },
            },
          },
        }))
        response.writeHead(200, { 'content-length': body.length, 'content-type': 'application/json' })
        response.end(body)
        return
      }

      const upstream = await fetch(`https://registry.npmjs.org${request.url || '/'}`, {
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await requestBody(request),
        headers: {
          'accept': request.headers.accept || 'application/json',
          'content-type': request.headers['content-type'] || 'application/json',
          'user-agent': 'advjs-local-registry/1',
        },
        method: request.method,
      })
      const body = Buffer.from(await upstream.arrayBuffer())
      response.writeHead(upstream.status, {
        'cache-control': upstream.headers.get('cache-control') || 'no-cache',
        'content-length': body.length,
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
      })
      response.end(body)
    }
    catch (error) {
      response.statusCode = 502
      response.end(error instanceof Error ? error.stack : String(error))
    }
  })

  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Local registry did not expose a TCP port')
  url = `http://127.0.0.1:${address.port}`

  return {
    localRequests,
    url,
    close: async () => await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())),
  }
}
