import type { CosReplayReceipt } from './cos-replay-config'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createAdvAssetCatalog, normalizeAdvAssetManifest } from '@advjs/assets'
import { audioProjectMediaPath, parseVoiceLedger } from '@advjs/audio'
import { createProjectGameConfig } from '@advjs/core'

const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const textSource = /\.(?:json|yaml|yml|md|txt)$/iu
const mediaSource = /\.(?:wav|webm|m4a|ogg|mp3|svg|png|jpe?g|webp|avif|woff2?|ttf|otf)$/iu
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

/** Copy only native author data and declared media, never environments or keys. */
async function copyNativeProject(source: string, destination: string) {
  const inventory: { path: string, bytes: number, sha256: string }[] = []
  let total = 0
  async function copyFile(path: string, maximum: number) {
    const bytes = await readFile(join(source, path))
    total += bytes.length
    if (bytes.length > maximum || total > 256 * 1024 * 1024 || inventory.length >= 2048)
      throw new Error('COS_REPLAY_NATIVE_LIMIT')
    await mkdir(resolve(destination, path, '..'), { recursive: true })
    await writeFile(join(destination, path), bytes)
    inventory.push({ path, bytes: bytes.length, sha256: digest(bytes) })
  }
  async function walk(path: string, media: boolean) {
    for (const entry of (await readdir(join(source, path), { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
        continue
      const next = `${path}/${entry.name}`
      if (entry.isSymbolicLink())
        throw new Error('COS_REPLAY_NATIVE_SYMLINK_FORBIDDEN')
      if (entry.isDirectory())
        await walk(next, media)
      else if (entry.isFile() && (media ? mediaSource : textSource).test(entry.name))
        await copyFile(next, media ? 64 * 1024 * 1024 : 1024 * 1024)
    }
  }
  await copyFile('adv.config.json', 1024 * 1024)
  const config = JSON.parse(await readFile(join(destination, 'adv.config.json'), 'utf8'))
  if (config.format !== 'flow' || config.root !== 'adv' || (config.theme && !['default', '@advjs/theme-default'].includes(config.theme)))
    throw new Error('COS_REPLAY_NATIVE_FLOW_REQUIRED')
  for (const path of ['adv', 'authoring/voices', 'authoring/rights', 'public']) {
    try {
      await walk(path, path === 'public')
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error
    }
  }
  return inventory.sort((left, right) => left.path.localeCompare(right.path))
}

async function publicBytes(url: string, maximum: number) {
  const response = await fetch(url, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30_000) })
  if (!response.ok || !response.body)
    throw new Error('COS_REPLAY_PUBLIC_OBJECT_UNAVAILABLE')
  const parts: Uint8Array[] = []
  const reader = response.body.getReader()
  let size = 0
  try {
    while (true) {
      const part = await reader.read()
      if (part.done)
        break
      size += part.value.byteLength
      if (size > maximum)
        throw new Error('COS_REPLAY_PUBLIC_OBJECT_LIMIT')
      parts.push(part.value)
    }
  }
  finally { await reader.cancel().catch(() => {}) }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.length
  }
  return { bytes, headers: { sha256: response.headers.get('x-cos-meta-sha256'), cacheControl: response.headers.get('cache-control'), cosRequestId: response.headers.get('x-cos-request-id') } }
}

/** Genuine COS objects + already generated Qwen; no provider is constructed. */
export async function createCosQwenReplayFixture(receipt: CosReplayReceipt) {
  const sourceRoot = await realpath(receipt.project)
  const root = await mkdtemp(join(tmpdir(), 'advjs-real-cos-qwen-player-'))
  const nativeFiles = await copyNativeProject(sourceRoot, root)
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'cos-qwen-replay', dependencies: { 'advjs': 'workspace:*', '@advjs/theme-default': 'workspace:*' } }))
  await symlink(resolve(import.meta.dirname, '../../../node_modules'), join(root, 'node_modules'), 'dir')
  // Playwright's repository tsconfig mapping redirects "advjs/node" into Node
  // TypeScript sources, whose JSON imports require its development loader.
  // This acceptance deliberately tests the already built production package.
  const nodeUrl = pathToFileURL(resolve(import.meta.dirname, '../../../packages/advjs/dist/node/index.mjs')).href
  const { advBuild, loadProject, runCheck } = await import(nodeUrl) as typeof import('advjs/node')
  const loaded = await loadProject({ root })
  if (loaded.result.diagnostics.some(diagnostic => diagnostic.severity === 'error'))
    throw new Error('COS_REPLAY_NATIVE_COMPILE_FAILED')
  const game = createProjectGameConfig(loaded.result, loaded.files)
  const lines = Object.entries(game.audio?.voiceLedger?.lines ?? {})
  if (lines.length !== 1)
    throw new Error('COS_REPLAY_EXACT_CURRENT_VOICE_REQUIRED')
  const [lineId, line] = lines[0]!
  const locale = game.audio?.locale ?? 'zh-CN'
  const binding = line.locales[locale]
  const native = parseVoiceLedger(JSON.parse(loaded.files['adv/audio/voice-ledger.json']!))
  const take = native.lines[lineId]?.locales[locale]?.takes.find(take => take.id === binding?.selectedTake)
  const asset = loaded.result.project.assets?.assets.find(asset => asset.id === take?.assetId)
  const node = Object.values(loaded.result.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).find(node => node.data?.lineId === lineId)
  if (!take || take.providerId !== 'qwen-tts' || !take.model.includes('Qwen3-TTS') || !asset || !node || typeof node.data?.text !== 'string' || !loaded.result.project.assets)
    throw new Error('COS_REPLAY_GENUINE_QWEN_IDENTITY_REQUIRED')
  const master = await readFile(join(root, audioProjectMediaPath(loaded.result.project.assets, asset)))
  if (digest(master) !== take.sha256 || asset.sha256 !== take.sha256)
    throw new Error('COS_REPLAY_NATIVE_MASTER_CHANGED')
  const published = await publicBytes(receipt.publication.manifestUrl, 2 * 1024 * 1024)
  if (digest(published.bytes) !== receipt.publication.revision || published.headers.sha256 !== receipt.publication.revision)
    throw new Error('COS_REPLAY_MANIFEST_PIN_CHANGED')
  const manifest = normalizeAdvAssetManifest(JSON.parse(new TextDecoder().decode(published.bytes)))
  if (manifest.assets.length !== 1 || manifest.assets[0]?.id !== take.assetId || manifest.assets[0]?.sha256 !== take.sha256 || manifest.assets[0]?.kind !== 'voice')
    throw new Error('COS_REPLAY_PUBLIC_SELECTION_CHANGED')
  const variants = []
  const catalog = createAdvAssetCatalog(manifest)
  try {
    for (const name of ['opus', 'aac']) {
      const variant = manifest.assets[0].variants?.[name]
      if (!variant?.bytes || !variant.sha256 || variant.path || !variant.objectKey?.includes(take.id))
        throw new Error('COS_REPLAY_PUBLIC_VARIANT_INVALID')
      const resolved = await catalog.resolve(take.assetId, { variant: name })
      const url = new URL(resolved.src)
      if (url.origin !== new URL(receipt.publication.manifestUrl).origin || url.search || url.hash)
        throw new Error('COS_REPLAY_PUBLIC_VARIANT_INVALID')
      const output = await publicBytes(url.href, Math.min(variant.bytes, 64 * 1024 * 1024))
      if (output.bytes.length !== variant.bytes || digest(output.bytes) !== variant.sha256 || output.headers.sha256 !== variant.sha256)
        throw new Error('COS_REPLAY_PUBLIC_VARIANT_CHANGED')
      variants.push({ name, url: url.href, bytes: variant.bytes, sha256: variant.sha256, mimeType: variant.mimeType, headers: output.headers })
    }
  }
  finally { catalog.dispose() }
  const check = await runCheck({ cwd: root })
  if (!check.passed || check.issues.some(issue => issue.type === 'warning' && issue.code !== 'ADV_AUDIO_ORPHAN_VOICE_LINE'))
    throw new Error('COS_REPLAY_NATIVE_CHECK_FAILED')
  const build = await advBuild({ userRoot: root, audioManifest: receipt.publication.manifestUrl, audioManifestSha256: receipt.publication.revision, vite: { logLevel: 'silent' } })
  if (resolve(build.root) !== resolve(root) || resolve(build.outDir) !== resolve(root, 'dist'))
    throw new Error('COS_REPLAY_BUILD_ROOT_CHANGED')
  if (build.assets.some(asset => /\.(?:wav|m4a|webm|ogg|mp3)$/iu.test(asset.path)))
    throw new Error('COS_REPLAY_BUILD_HAS_LOCAL_AUDIO')
  const scripts = (await Promise.all(build.assets.filter(asset => asset.path.endsWith('.js')).map(asset => readFile(join(build.outDir, asset.path), 'utf8')))).join('\n')
  for (const value of ['authoring/voices/', 'authoring/rights/', 'voice/samples/', '.advjs/voice']) {
    if (scripts.includes(value) || build.assets.some(asset => asset.path.includes(value)))
      throw new Error('COS_REPLAY_BUILD_PRIVATE_AUDIO')
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
    throw new Error('COS_REPLAY_PLAYER_ADDRESS_UNAVAILABLE')
  return {
    sourceRoot,
    root,
    nativeFiles,
    publication: receipt.publication,
    take,
    lineId,
    text: node.data.text,
    locale,
    choiceLabel: receipt.choiceLabel ?? '走左侧',
    branchText: receipt.branchText ?? '进入左侧分支。',
    master: { path: audioProjectMediaPath(loaded.result.project.assets, asset), sha256: take.sha256, bytes: master.length },
    variants,
    check,
    build,
    playerUrl: `http://127.0.0.1:${address.port}`,
    async verifySourceUnchanged() {
      for (const file of nativeFiles) {
        const bytes = await readFile(join(sourceRoot, file.path))
        if (bytes.length !== file.bytes || digest(bytes) !== file.sha256)
          throw new Error('COS_REPLAY_ORIGINAL_AUTHOR_CHANGED')
      }
    },
    async close() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
