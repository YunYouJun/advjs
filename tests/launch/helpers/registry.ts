import { Buffer } from 'node:buffer'
import { readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { basename, join } from 'node:path'
import process from 'node:process'
import { readTarEntries } from '../../../scripts/release/package-manifest.mjs'
import { runCommand, runNpx, runPnpm } from '../../../scripts/release/run-command.mjs'

interface PackedManifestItem {
  integrity: string
  name: string
  tarball: string
  version: string
}

interface PackedManifest {
  packages: PackedManifestItem[]
}

export function shouldRemoveLaunchTemporaryRoot(platform = process.platform, ci = process.env.CI) {
  return platform !== 'win32' || !['1', 'true'].includes(ci || '')
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
    npm_config_userconfig: join(temporaryRoot, 'registry.npmrc'),
    npm_config_update_notifier: 'false',
    pnpm_config_store_dir: join(temporaryRoot, 'pnpm-store'),
  }
  delete environment.NODE_PATH
  delete environment.PNPM_HOME
  return environment
}

export async function writeLaunchRegistryConfig(temporaryRoot: string, registryUrl: string) {
  await writeFile(
    join(temporaryRoot, 'registry.npmrc'),
    `registry=${registryUrl}\naudit=false\nfund=false\nupdate-notifier=false\n`,
    'utf8',
  )
}

export async function writeLaunchWorkspaceConfig(directory: string, overrides?: Record<string, string>) {
  // Mirror the repository's explicit pnpm 11 lifecycle-script decisions in
  // isolated consumer workspaces. Unknown scripts must still fail closed.
  const allowBuilds = {
    '@parcel/watcher': false,
    'bufferutil': false,
    'core-js': false,
    'core-js-pure': false,
    'cos-js-sdk-v5': false,
    'esbuild': false,
    'msw': false,
    'protobufjs': false,
    'sharp': true,
    'unrs-resolver': false,
    'vue-demi': true,
    'workerd': true,
  }
  await writeFile(
    join(directory, 'pnpm-workspace.yaml'),
    `${JSON.stringify({ allowBuilds, overrides }, null, 2)}\n`,
    'utf8',
  )
}

export async function runLaunchCommand(command: string, args: string[], cwd: string, registryUrl: string, temporaryRoot: string, environment: NodeJS.ProcessEnv = {}) {
  const commandEnvironment = { ...launchRegistryEnvironment(registryUrl, temporaryRoot), ...environment }
  if (command === 'npx') {
    delete commandEnvironment.pnpm_config_store_dir
  }
  const options = {
    cwd,
    env: commandEnvironment,
    maxBuffer: 20 * 1024 * 1024,
    timeout: command === 'npx' ? 300_000 : 180_000,
  }
  if (command === 'pnpm')
    return await runPnpm(args, options)
  if (command === 'npx')
    return await runNpx(args, options)
  return await runCommand(command, args, options)
}

export async function createLaunchRegistry(packageManifest: PackedManifest, tarballDirectory: string) {
  const metadata = new Map<string, { item: PackedManifestItem, packedPackage: Record<string, unknown>, tarballPath: string }>()
  const tarballs = new Map<string, Buffer>()
  const localRequests: string[] = []
  const sockets = new Set<import('node:net').Socket>()
  const upstreamController = new AbortController()
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
        signal: upstreamController.signal,
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
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
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
    close: async () => {
      upstreamController.abort()
      server.close()
      server.closeAllConnections()
      for (const socket of sockets)
        socket.destroy()
      server.unref()
    },
  }
}
