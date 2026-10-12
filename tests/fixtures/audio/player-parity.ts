import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readdir, readFile, realpath } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { audioProjectMediaPath } from '@advjs/audio'
import { createProjectGameConfig } from '@advjs/core'
import { installPlayerParityProbe } from './audio-probe'

export interface PlayerParityInput {
  host: 'editor' | 'studio'
  nativeRoot: string
  outDir: string
  lineId: string
  takeId: string
  assetId: string
  masterSha256: string
}

/** Explicit local acceptance metadata; not another project/runtime protocol. */
export function parsePlayerParityInputs(value: unknown): PlayerParityInput[] {
  if (!Array.isArray(value) || !value.length || value.length > 8)
    throw new Error('PLAYER_PARITY_INPUTS_REQUIRED')
  return value.map((input) => {
    if (!input || !['editor', 'studio'].includes(input.host) || !isAbsolute(input.nativeRoot ?? '') || !isAbsolute(input.outDir ?? '') || !/^line_[\w-]+$/u.test(input.lineId ?? '') || !/^take_[\w-]+$/u.test(input.takeId ?? '') || typeof input.assetId !== 'string' || !/^[a-f0-9]{64}$/u.test(input.masterSha256 ?? ''))
      throw new Error('PLAYER_PARITY_INPUT_INVALID')
    return { host: input.host, nativeRoot: input.nativeRoot, outDir: input.outDir, lineId: input.lineId, takeId: input.takeId, assetId: input.assetId, masterSha256: input.masterSha256 }
  })
}

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const contentTypes: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.webm': 'audio/webm', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.png': 'image/png', '.woff2': 'font/woff2' }

async function inventory(root: string) {
  const files: { path: string, bytes: number, sha256: string }[] = []
  let total = 0
  async function walk(path: string) {
    for (const entry of (await readdir(join(root, path), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.'))
        continue
      const next = path ? `${path}/${entry.name}` : entry.name
      if (entry.isSymbolicLink())
        throw new Error('PLAYER_PARITY_SOURCE_SYMLINK')
      if (entry.isDirectory()) {
        await walk(next)
      }
      else if (entry.isFile()) {
        const bytes = await readFile(join(root, next))
        total += bytes.length
        if (files.length >= 4096 || total > 256 * 1024 * 1024)
          throw new Error('PLAYER_PARITY_SOURCE_LIMIT')
        files.push({ path: next, bytes: bytes.length, sha256: digest(bytes) })
      }
    }
  }
  await walk('')
  return files
}

/** Only serves an existing ordinary build. No build, provider, SDK or author writes. */
export async function createPlayerParityFixture(input: PlayerParityInput, port = 4188, injectProbe = false) {
  const nativeRoot = await realpath(input.nativeRoot)
  const outDir = await realpath(input.outDir)
  const nativeFiles = await inventory(nativeRoot)
  const distFiles = await inventory(outDir)
  if (!distFiles.some(file => file.path === 'index.html') || distFiles.some(file => /(?:authoring|voice\/samples|reference|preset|consent|\.advjs)\//u.test(file.path)))
    throw new Error('PLAYER_PARITY_PRIVATE_DIST')
  const { loadProject } = await import(pathToFileURL(resolve(import.meta.dirname, '../../../packages/advjs/dist/node/index.mjs')).href) as typeof import('advjs/node')
  const loaded = await loadProject({ root: nativeRoot })
  if (loaded.result.diagnostics.some(diagnostic => diagnostic.severity === 'error'))
    throw new Error('PLAYER_PARITY_NATIVE_INVALID')
  const game = createProjectGameConfig(loaded.result, loaded.files)
  const locale = game.audio?.locale ?? game.locale ?? 'zh-CN'
  const line = game.audio?.voiceLedger?.lines[input.lineId]
  const binding = line?.locales[locale]
  const take = binding?.takes.find(take => take.id === input.takeId)
  const node = Object.values(loaded.result.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).find(node => node.data?.lineId === input.lineId)
  if (!line || binding?.selectedTake !== input.takeId || take?.assetId !== input.assetId || take.sha256 !== input.masterSha256 || typeof node?.data?.text !== 'string')
    throw new Error('PLAYER_PARITY_CURRENT_SELECTION_CHANGED')
  const asset = loaded.result.project.assets?.assets.find(asset => asset.id === input.assetId)
  if (!asset || !loaded.result.project.assets || digest(await readFile(join(nativeRoot, audioProjectMediaPath(loaded.result.project.assets, asset)))) !== input.masterSha256)
    throw new Error('PLAYER_PARITY_NATIVE_MASTER_CHANGED')
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method ?? '')) {
        response.writeHead(405).end()
        return
      }
      const path = decodeURIComponent(new URL(request.url!, 'http://127.0.0.1').pathname)
      const target = resolve(outDir, `.${path === '/' ? '/index.html' : path}`)
      const coordinate = relative(outDir, target)
      if (isAbsolute(coordinate) || coordinate === '..' || coordinate.startsWith('../') || coordinate.includes('\\')) {
        response.writeHead(400).end()
        return
      }
      const file = extname(target) ? target : join(outDir, 'index.html')
      const original = await readFile(file)
      const bytes = injectProbe && extname(file) === '.html'
        ? Buffer.from(original.toString().replace('<head>', `<head><script>(${installPlayerParityProbe.toString()})();</script>`))
        : original
      const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/u)
      const start = range ? Number(range[1]) : 0
      const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1
      if (start > end || start >= bytes.length) {
        response.writeHead(416).end()
        return
      }
      const body = bytes.subarray(start, end + 1)
      response.writeHead(range ? 206 : 200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream', 'content-length': body.length, 'accept-ranges': 'bytes', 'cache-control': 'no-store', ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}) }).end(request.method === 'HEAD' ? undefined : body)
    }
    catch { response.writeHead(404).end() }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return {
    input,
    text: node.data.text,
    speakerId: line.speakerId,
    locale,
    nativeFiles,
    distFiles,
    url: `http://127.0.0.1:${port}`,
    async verifyUnchanged() {
      if (JSON.stringify(await inventory(nativeRoot)) !== JSON.stringify(nativeFiles) || JSON.stringify(await inventory(outDir)) !== JSON.stringify(distFiles))
        throw new Error('PLAYER_PARITY_NATIVE_OR_DIST_MUTATED')
    },
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
