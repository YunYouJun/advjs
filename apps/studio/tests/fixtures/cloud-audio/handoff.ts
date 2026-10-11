import type { HostedAudioPublication } from '../../../../../packages/advjs/shared/hosted-audio'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import JSZip from 'jszip'

const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }

/** Exact production UI ZIP bytes; executable project sources are never evaluated. */
export async function unpackCloudStudioExport(bytes: Uint8Array, root: string) {
  if (bytes.byteLength > 128 * 1024 * 1024)
    throw new Error('STUDIO_CLOUD_ZIP_LIMIT')
  const zip = await JSZip.loadAsync(bytes)
  if (Object.keys(zip.files).length > 2048)
    throw new Error('STUDIO_CLOUD_ZIP_LIMIT')
  const inventory: { path: string, bytes: number, sha256: string }[] = []
  let total = 0
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || entry.name === 'manifest.json')
      continue
    const sourceName = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name
    if (sourceName !== entry.name || entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').some(part => ['.', '..', 'node_modules', '.git', '.advjs'].includes(part)) || /\.(?:[cm]?[jt]sx?|vue|html)$/iu.test(entry.name))
      throw new Error('STUDIO_CLOUD_ZIP_PATH_INVALID')
    // The central-directory bound prevents expanding a malicious compressed
    // entry before checking the byte count. JSZip supplies this parsed size.
    const size = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
    if (!Number.isSafeInteger(size) || size! < 0 || size! > 64 * 1024 * 1024 || total + size! > 256 * 1024 * 1024)
      throw new Error('STUDIO_CLOUD_ZIP_LIMIT')
    const content = await entry.async('uint8array')
    if (content.byteLength !== size)
      throw new Error('STUDIO_CLOUD_ZIP_LIMIT')
    total += content.byteLength
    const path = join(root, entry.name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
    inventory.push({ path: entry.name, bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex') })
  }
  const config = JSON.parse(await readFile(join(root, 'adv.config.json'), 'utf8'))
  if (config.format !== 'flow' || config.root !== 'adv' || (config.theme && !['default', '@advjs/theme-default'].includes(config.theme)))
    throw new Error('STUDIO_CLOUD_FLOW_PROJECT_REQUIRED')
  return inventory.sort((left, right) => left.path.localeCompare(right.path))
}

/** Local static hosting proves actual cloud-media playback, never cloud compute. */
export async function buildCloudStudioHandoff(bytes: Uint8Array, publication: HostedAudioPublication) {
  const root = await mkdtemp(join(tmpdir(), 'advjs-studio-cloud-export-'))
  const inventory = await unpackCloudStudioExport(bytes, root)
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'studio-cloud-handoff', dependencies: { 'advjs': 'workspace:*', '@advjs/theme-default': 'workspace:*' } }))
  await symlink(resolve(import.meta.dirname, '../../../../../node_modules'), join(root, 'node_modules'), 'dir')
  const nodeUrl = pathToFileURL(resolve(import.meta.dirname, '../../../../../packages/advjs/dist/node/index.mjs')).href
  const { advBuild, runCheck } = await import(nodeUrl) as typeof import('advjs/node')
  const check = await runCheck({ cwd: root })
  if (!check.passed)
    throw new Error('STUDIO_CLOUD_EXPORTED_PROJECT_CHECK_FAILED')
  const build = await advBuild({ userRoot: root, audioManifest: publication.manifestUrl, audioManifestSha256: publication.revision, vite: { logLevel: 'silent' } })
  if (resolve(build.root) !== resolve(root) || resolve(build.outDir) !== resolve(root, 'dist'))
    throw new Error('STUDIO_CLOUD_BUILD_ROOT_CHANGED')
  if (build.assets.some(asset => /\.(?:wav|m4a|webm|ogg|mp3)$/iu.test(asset.path)))
    throw new Error('STUDIO_CLOUD_BUILD_INCLUDED_LOCAL_AUDIO')
  const bundle = (await Promise.all(build.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(build.outDir, asset.path), 'utf8')))).join('\n')
  for (const path of ['authoring/voices/', 'authoring/rights/', 'voice/samples/', '.advjs/voice']) {
    if (bundle.includes(path) || build.assets.some(asset => asset.path.includes(path)))
      throw new Error('STUDIO_CLOUD_BUILD_PRIVATE_AUDIO')
  }
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405).end()
        return
      }
      const path = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname)
      const file = resolve(build.outDir, `.${path === '/' ? '/index.html' : path}`)
      const coordinate = relative(build.outDir, file)
      if (isAbsolute(coordinate) || coordinate === '..' || coordinate.startsWith('../') || coordinate.includes('\\')) {
        response.writeHead(400).end()
        return
      }
      const bytes = await readFile(extname(file) ? file : join(build.outDir, 'index.html'))
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-length': bytes.length, 'cache-control': 'no-store' }).end(request.method === 'HEAD' ? undefined : bytes)
    }
    catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('STUDIO_CLOUD_PLAYER_ADDRESS_UNAVAILABLE')
  return {
    root,
    inventory,
    check: { passed: check.passed, issues: check.issues },
    build,
    playerUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
