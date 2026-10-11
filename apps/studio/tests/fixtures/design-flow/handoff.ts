import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { advBuild } from '../../../../../packages/advjs/node/commands/build'
import { runCheck } from '../../../../../packages/advjs/node/commands/check'

const contentTypes: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.png': 'image/png', '.woff2': 'font/woff2' }

/** Actual browser-exported native ZIP -> ordinary check/build -> static player. */
export async function buildStudioNativeHandoff(root: string) {
  const check = await runCheck({ cwd: root })
  if (!check.passed)
    throw new Error(`Exported native project failed adv check: ${JSON.stringify(check.issues)}`)
  const build = await advBuild({ userRoot: root, vite: { logLevel: 'silent' } })
  if (await realpath(build.root) !== await realpath(root) || await realpath(build.outDir) !== await realpath(join(root, 'dist')))
    throw new Error('Native build crossed the exported project root')
  const bundle = (await Promise.all(build.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(build.outDir, asset.path), 'utf8')))).join('\n')
  for (const path of ['authoring/voices/', 'authoring/rights/', 'voice/samples/', 'reference.wav']) {
    if (bundle.includes(path) || build.assets.some(asset => asset.path.includes(path)))
      throw new Error(`Private authoring resource reached player: ${path}`)
  }
  const media = await Promise.all(build.assets.filter(asset => /\.(?:wav|m4a|webm|ogg|mp3)$/u.test(asset.path)).map(async asset => ({ path: asset.path, sha256: createHash('sha256').update(await readFile(join(build.outDir, asset.path))).digest('hex') })))
  if (!media.length)
    throw new Error('Exported native player contains no declared playable media')
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405).end()
        return
      }
      const path = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname)
      const target = resolve(build.outDir, `.${path === '/' ? '/index.html' : path}`)
      const coordinate = relative(build.outDir, target)
      if (isAbsolute(coordinate) || coordinate === '..' || coordinate.startsWith('../') || coordinate.includes('\\')) {
        response.writeHead(400).end()
        return
      }
      const file = extname(target) ? target : join(build.outDir, 'index.html')
      const bytes = await readFile(file)
      response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream', 'content-length': bytes.length, 'cache-control': 'no-store' }).end(request.method === 'HEAD' ? undefined : bytes)
    }
    catch { response.writeHead(404).end() }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Native player server address unavailable')
  return {
    check: { passed: check.passed, issues: check.issues, scriptCount: check.scriptCount },
    build: { outDir: build.outDir, assets: build.assets, media },
    playerUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
