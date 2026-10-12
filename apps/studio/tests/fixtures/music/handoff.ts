import { createHash } from 'node:crypto'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { advBuild, runCheck } from 'advjs/node'
import { unpackCloudStudioExport } from '../cloud-audio/handoff'
import { privateBrief, privateLicense, sourceUrl } from './project'

const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.png': 'image/png', '.woff2': 'font/woff2' }
export async function musicNativeHandoff(zip: Uint8Array, root: string, selectedAssetId: string, unusedAssetId: string) {
  await mkdir(root, { recursive: true })
  const inventory = await unpackCloudStudioExport(zip, root)
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'studio-music-player', dependencies: { 'advjs': 'workspace:*', '@advjs/theme-default': 'workspace:*' } }))
  await symlink(resolve(import.meta.dirname, '../../../../../node_modules'), join(root, 'node_modules'), 'dir')
  const check = await runCheck({ cwd: root })
  if (!check.passed)
    throw new Error('MUSIC_EXPORTED_PROJECT_INVALID')
  const build = await advBuild({ userRoot: root, vite: { logLevel: 'silent' } })
  const texts = await Promise.all(build.assets.filter(asset => /\.(?:js|json|html)$/u.test(asset.path)).map(asset => readFile(join(build.outDir, asset.path), 'utf8')))
  const publicText = texts.join('\n')
  for (const forbidden of [privateBrief, privateLicense, sourceUrl, unusedAssetId]) {
    if (publicText.includes(forbidden))
      throw new Error('MUSIC_PRIVATE_METADATA_REACHED_PLAYER')
  }
  if (!publicText.includes(selectedAssetId))
    throw new Error('MUSIC_BOUND_ASSET_MISSING')
  const media = await Promise.all(build.assets.filter(asset => asset.path.endsWith('.wav')).map(async asset => ({ path: asset.path, sha256: createHash('sha256').update(await readFile(join(build.outDir, asset.path))).digest('hex') })))
  if (media.length !== 1)
    throw new Error('MUSIC_UNUSED_MASTER_COPIED')
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405).end()
        return
      }
      const path = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname)
      const target = resolve(build.outDir, `.${path === '/' ? '/index.html' : path}`)
      const coordinate = relative(build.outDir, target)
      if (isAbsolute(coordinate) || coordinate.startsWith('..') || coordinate.includes('\\')) {
        response.writeHead(400).end()
        return
      }
      const file = extname(target) ? target : join(build.outDir, 'index.html')
      const bytes = await readFile(file)
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-length': bytes.length, 'cache-control': 'no-store' }).end(request.method === 'HEAD' ? undefined : bytes)
    }
    catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('MUSIC_PLAYER_SERVER_FAILED')
  return { inventory, check, media, outDir: build.outDir, playerUrl: `http://127.0.0.1:${address.port}`, async close() {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  } }
}
