import type { AdvAssetEntry, AdvAssetManifest, AdvConfig, AdvVoiceCandidate, AdvVoiceSynthesisRequest } from '@advjs/types'
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { audioProjectMediaPath, canonicalAudioJson, parseVoiceDesignLibrary, parseVoiceLedger } from '@advjs/audio'
import { createQwenTtsProvider } from '../../../plugins/plugin-qwen-tts/src/index'
import { defaultRealQwenRoot, REAL_QWEN_MODELS, REAL_QWEN_PRESETS, REAL_QWEN_RECEIPT } from '../../../scripts/prepare-real-qwen.mjs'

export const realQwenLineId = 'line_019d137e-7abc-7000-8000-00000000e001'
export const realQwenChapterPath = 'adv/chapters/editor-real-qwen.chapter.json'
export const realQwenPrivateMarker = 'EDITOR-REAL-QWEN-PRIVATE-AUTHOR-DATA'
export const realQwenModel = REAL_QWEN_MODELS.design.model
export const realQwenModelRevision = REAL_QWEN_MODELS.design.revision
export const realQwenDialogue = '你好，我们一起出发吧。'
export const realQwenPreviewText = '你好，这是我的原创声音。今天的阳光很温暖，让我们怀着平静的心情，一起开始新的旅程。'
export const realQwenConsentPath = 'authoring/rights/editor-real-original-synthetic-qwen.json'

/** Guard before touching finite native sources, rather than accepting any ready game. */
export function assertRealQwenPreparedProject(root: string, marker: any, receipt: any) {
  if (marker?.schemaVersion !== 1 || marker.kind !== 'advjs-real-qwen-acceptance' || marker.root !== root
    || receipt?.schemaVersion !== 1 || receipt.kind !== marker.kind || receipt.root !== root || receipt.status !== 'ready'
    || receipt.providerId !== 'qwen-tts' || !receipt.doctor?.ready
    || canonicalAudioJson(receipt.models ?? null) !== canonicalAudioJson(REAL_QWEN_MODELS)
    || canonicalAudioJson(receipt.presetsMap ?? null) !== canonicalAudioJson(REAL_QWEN_PRESETS)) {
    throw new Error('REAL_QWEN_DEDICATED_PREPARED_PROJECT_REQUIRED')
  }
}

/** Reset only the Editor acceptance namespace, after copying its previous evidence. */
export async function resetEditorRealQwenScope(root: string, backupRoot: string) {
  const marker = JSON.parse(await readFile(join(root, '.advjs/voice/real-qwen-project.json'), 'utf8'))
  const receipt = JSON.parse(await readFile(join(root, REAL_QWEN_RECEIPT), 'utf8'))
  assertRealQwenPreparedProject(root, marker, receipt)
  const raw = new Map<string, string>()
  async function readOptional(path: string) {
    const text = await readFile(join(root, path), 'utf8').catch((error) => {
      if (error.code !== 'ENOENT')
        throw error
      return undefined
    })
    if (text !== undefined)
      raw.set(path, text)
    return text
  }
  for (const path of ['adv.config.json', 'package.json', 'adv/settings/game.json', 'adv/audio/voice-ledger.json', 'authoring/voices/library.json', realQwenConsentPath, 'adv/assets.json'])
    await readOptional(path)
  const ledgerText = raw.get('adv/audio/voice-ledger.json')
  const ledger = ledgerText === undefined ? undefined : parseVoiceLedger(ledgerText)
  const libraryText = raw.get('authoring/voices/library.json')
  const library = libraryText === undefined ? undefined : parseVoiceDesignLibrary(libraryText)
  const ownsVoice = (id: string) => /^editor-real-(?:designed|cloned)-\d+$/u.test(id)
  const ownVoices = library?.voices.filter(voice => ownsVoice(voice.id)) ?? []
  const assetIds = new Set<string>()
  for (const binding of Object.values(ledger?.lines[realQwenLineId]?.locales ?? {})) {
    for (const take of binding.takes)
      assetIds.add(take.assetId)
  }
  for (const voice of ownVoices) {
    for (const sample of voice.design?.samples ?? [])
      assetIds.add(sample.assetId)
  }
  const removed: string[] = []
  const chapters = await readdir(join(root, 'adv/chapters')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  for (const name of chapters.filter(name => /^editor-real-[\w.-]+\.chapter\.json$/u.test(name))) {
    const path = `adv/chapters/${name}`
    await readOptional(path)
    removed.push(path)
  }
  // Preserve every old immutable design preset, including a failed save's orphan.
  const designs = await readdir(join(root, 'authoring/voices/designs')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))
  for (const id of designs.filter(ownsVoice)) {
    const directory = `authoring/voices/designs/${id}`
    for (const name of await readdir(join(root, directory), { recursive: true, withFileTypes: true })) {
      if (name.isFile())
        await readOptional(relative(root, join(name.parentPath, name.name)))
    }
    removed.push(directory)
  }
  const catalogText = raw.get('adv/assets.json')
  let catalog: AdvAssetManifest | undefined
  if (catalogText !== undefined) {
    const source = JSON.parse(catalogText)
    const assets: AdvAssetEntry[] = source.assets ?? []
    for (const include of source.includes ?? []) {
      if (typeof include !== 'string' || /^(?:[a-z]+:|\/|\\)/iu.test(include) || include.includes('\\') || include.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part)))
        throw new Error('REAL_QWEN_BACKUP_CATALOG_INVALID')
      const fragment = await readOptional(`adv/${include}`)
      if (fragment === undefined)
        throw new Error('REAL_QWEN_BACKUP_CATALOG_INVALID')
      assets.push(...JSON.parse(fragment).assets)
    }
    catalog = { ...source, assets }
  }
  const media = new Map<string, Uint8Array>()
  for (const asset of catalog?.assets ?? []) {
    if (!assetIds.has(asset.id) && !/^editor-designed-reference-\d+\.wav$/u.test(asset.title ?? ''))
      continue
    const path = audioProjectMediaPath(catalog!, asset)
    const target = await realpath(join(root, path))
    if (relative(root, target).startsWith('..') || (await stat(target)).size > 20 * 1024 * 1024)
      throw new Error('REAL_QWEN_BACKUP_MEDIA_INVALID')
    const bytes = await readFile(target)
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256)
      throw new Error('REAL_QWEN_BACKUP_MEDIA_CHANGED')
    media.set(path, bytes)
  }
  // Finish all backups before deleting or changing any original author record.
  for (const [path, content] of [...raw, ...media]) {
    await mkdir(join(backupRoot, path, '..'), { recursive: true })
    await writeFile(join(backupRoot, path), content)
  }
  await mkdir(backupRoot, { recursive: true })
  await writeFile(join(backupRoot, 'reset-inventory.json'), `${JSON.stringify({ removed, ledgerLineId: realQwenLineId, voiceIds: ownVoices.map(voice => voice.id), media: [...media.keys()], raw: [...raw.keys()] }, null, 2)}\n`)
  for (const path of removed)
    await rm(join(root, path), { recursive: true, force: true })
  if (ledger?.lines[realQwenLineId]) {
    delete ledger.lines[realQwenLineId]
    await writeFile(join(root, 'adv/audio/voice-ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`)
  }
  if (library && ownVoices.length) {
    library.voices = library.voices.filter(voice => !ownsVoice(voice.id))
    await writeFile(join(root, 'authoring/voices/library.json'), `${JSON.stringify(library, null, 2)}\n`)
  }
  await rm(join(root, realQwenConsentPath), { force: true })
  return { raw: [...raw.keys()], media: [...media.keys()], removed }
}

/** Explicit acceptance only. Never prepare an environment or download a model here. */
export async function createEditorRealQwenFixture() {
  if (process.env.ADVJS_REAL_QWEN !== '1')
    throw new Error('Set ADVJS_REAL_QWEN=1 before real acceptance')
  const repositoryRoot = resolve(import.meta.dirname, '../../..')
  const root = await realpath(defaultRealQwenRoot())
  const marker = JSON.parse(await readFile(join(root, '.advjs/voice/real-qwen-project.json'), 'utf8'))
  const receipt = JSON.parse(await readFile(join(root, REAL_QWEN_RECEIPT), 'utf8'))
  assertRealQwenPreparedProject(root, marker, receipt)
  const resume = process.env.ADVJS_REAL_QWEN_RESUME_ARTIFACTS
  const artifactRoot = resume ? await realpath(resume) : join(resolve(process.env.ADVJS_REAL_QWEN_ARTIFACTS ?? join(tmpdir(), 'advjs-editor-real-qwen-artifacts')), `run-${Date.now()}`)
  if (!relative(root, artifactRoot).startsWith('..'))
    throw new Error('REAL_QWEN_ARTIFACTS_MUST_STAY_OUTSIDE_PROJECT')
  const presetPath = REAL_QWEN_PRESETS.design
  const presetBytes = await readFile(join(root, presetPath))
  const preset = JSON.parse(presetBytes.toString())
  if (preset.model !== realQwenModel || preset.revision !== realQwenModelRevision || canonicalAudioJson(preset.weightSha256 ?? null) !== canonicalAudioJson(REAL_QWEN_MODELS.design.weightSha256))
    throw new Error('Real acceptance requires the prepared, revision and weight hash pinned VoiceDesign preset')

  const provider = createQwenTtsProvider()
  const doctor = await provider.doctor({ root })
  if (!doctor.ready)
    throw new Error('The unique Qwen environment must be prepared by the setup task before Editor acceptance')
  const calls: Array<{ character?: string, text?: string, preset: string, offline: true, candidates: AdvVoiceCandidate[] }> = []
  if (resume) {
    const previous = JSON.parse(await readFile(join(artifactRoot, 'provider-calls.json'), 'utf8'))
    if (!Array.isArray(previous) || previous.length !== 4)
      throw new Error('REAL_QWEN_RESUME_REQUIRES_FOUR_COMPLETED_CALLS')
    for (const [index, call] of previous.entries()) {
      if (call.offline !== true || call.candidates?.length !== 1)
        throw new Error('REAL_QWEN_RESUME_PROVENANCE_INVALID')
      const candidate = call.candidates[0]
      const pinned = index < 2 ? REAL_QWEN_MODELS.design : REAL_QWEN_MODELS.base
      if (candidate.provider !== 'qwen-tts' || candidate.model !== pinned.model || candidate.revision !== pinned.revision)
        throw new Error('REAL_QWEN_RESUME_MODEL_CHANGED')
      const path = await realpath(join(root, candidate.path))
      if (relative(root, path).startsWith('..'))
        throw new Error('REAL_QWEN_RESUME_MEDIA_INVALID')
      const bytes = await readFile(path)
      if (bytes.length !== candidate.bytes || createHash('sha256').update(bytes).digest('hex') !== candidate.sha256)
        throw new Error('REAL_QWEN_RESUME_MEDIA_CHANGED')
      calls.push(call)
    }
  }
  const synthesize = provider.synthesize.bind(provider)
  provider.synthesize = async (request: AdvVoiceSynthesisRequest) => {
    if (resume)
      throw new Error('REAL_QWEN_RESUME_CANNOT_GENERATE')
    const result = await synthesize({ ...request, offline: true })
    calls.push({ character: request.character, text: request.text, preset: request.preset, offline: true, candidates: result.candidates })
    return result
  }
  const basePresetPath = REAL_QWEN_PRESETS.base
  const basePreset = JSON.parse(await readFile(join(root, basePresetPath), 'utf8'))
  if (basePreset.model !== REAL_QWEN_MODELS.base.model || basePreset.revision !== REAL_QWEN_MODELS.base.revision || canonicalAudioJson(basePreset.weightSha256 ?? null) !== canonicalAudioJson(REAL_QWEN_MODELS.base.weightSha256))
    throw new Error('Real acceptance requires the prepared, hash pinned Base reference preset')
  const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, defaultPreset: 'design', presets: { design: presetPath, base: basePresetPath } } } }
  const stored = resume ? (await readdir(artifactRoot)).filter(path => /^host-state-\d+$/u.test(path)) : []
  if (resume && stored.length !== 1)
    throw new Error('REAL_QWEN_RESUME_HOST_STATE_REQUIRED')
  const storeDirectory = join(artifactRoot, resume ? stored[0]! : `host-state-${Date.now()}`)
  await mkdir(storeDirectory, { recursive: true })
  if (resume)
    return { root, artifactRoot, storeDirectory, config, calls, doctor, resume: true, baseModel: basePreset.model as string, baseModelRevision: basePreset.revision as string, presetSha256: createHash('sha256').update(presetBytes).digest('hex') }
  const priorRoot = join(artifactRoot, `prior-native-${Date.now()}`)
  await resetEditorRealQwenScope(root, priorRoot)
  const previousGameText = await readFile(join(root, 'adv/settings/game.json'), 'utf8').catch(error => error.code === 'ENOENT' ? '{}' : Promise.reject(error))
  const otherCharacters = (JSON.parse(previousGameText).characters ?? []).filter((character: any) => character.id !== 'hero')
  const chapter = {
    schemaVersion: 1,
    id: 'editor-real-qwen',
    title: '真实 Qwen Editor',
    startNodeId: 'real-dialogue',
    authoring: { privateMarker: realQwenPrivateMarker },
    nodes: [
      { id: 'real-dialogue', type: 'dialogues', position: { x: 180, y: 120 }, imagePrompt: realQwenPrivateMarker, dialogues: [{ speakerId: 'hero', text: '你好。', lineId: realQwenLineId }], next: 'real-choice' },
      { id: 'real-choice', type: 'choices', choices: [{ id: 'continue', text: '继续旅程', target: 'real-end', when: 'ready == true' }, { id: 'blocked', text: '不可用的路线', target: 'real-end', when: 'ready == false' }] },
      { id: 'real-end', type: 'end', next: null },
    ],
  }
  const files: Record<string, unknown> = {
    'adv.config.json': { id: 'editor-real-qwen', format: 'flow', root: 'adv', theme: 'default', features: { babylon: false } },
    'adv/settings/game.json': { title: '真实 Qwen Editor 验收', locale: 'zh-CN', entryChapterId: 'editor-real-qwen', variables: { ready: true }, characters: [{ id: 'hero', name: 'Hero' }, ...otherCharacters], chapters: [{ id: 'editor-real-qwen', sources: ['chapters/editor-real-qwen.chapter.json'] }] },
    'package.json': { name: 'advjs-real-qwen-acceptance', private: true, type: 'module' },
    [realQwenChapterPath]: chapter,
  }
  // Other host scopes and immutable masters remain in the project. Old Editor
  // records and media are recoverable in this run's complete finite backup.
  for (const [path, content] of Object.entries(files)) {
    const previous = await readFile(join(root, path)).catch((error) => {
      if (error.code !== 'ENOENT')
        throw error
      return undefined
    })
    if (previous) {
      await mkdir(join(priorRoot, path, '..'), { recursive: true })
      await writeFile(join(priorRoot, path), previous)
    }
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), `${JSON.stringify(content, null, 2)}\n`)
  }
  const catalog = join(root, 'adv/assets.json')
  if (!await stat(catalog).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))) {
    await writeFile(catalog, `${JSON.stringify({ schemaVersion: 2, id: 'real-qwen-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }, null, 2)}\n`)
  }
  await mkdir(join(root, 'public/media'), { recursive: true })
  if (!await stat(join(root, 'node_modules')).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error)))
    await symlink(join(repositoryRoot, 'demo/flow/node_modules'), join(root, 'node_modules'), 'dir')
  return { root, artifactRoot, storeDirectory, config, calls, doctor, resume: false, baseModel: basePreset.model as string, baseModelRevision: basePreset.revision as string, presetSha256: createHash('sha256').update(presetBytes).digest('hex') }
}

/** Ordinary immutable native build server, with the range protocol used by WAV. */
export async function serveRealQwenPlayer(root: string) {
  const dist = join(root, 'dist')
  const mimeTypes: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.wav': 'audio/wav', '.png': 'image/png', '.woff2': 'font/woff2' }
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url!, 'http://127.0.0.1').pathname
      const target = resolve(dist, `.${path === '/' ? '/index.html' : decodeURIComponent(path)}`)
      if (relative(dist, target).startsWith('..'))
        throw new Error('Invalid path')
      const file = extname(target) ? target : join(dist, 'index.html')
      const bytes = await readFile(file)
      const headers = { 'content-type': mimeTypes[extname(file)] ?? 'application/octet-stream', 'accept-ranges': 'bytes' }
      const range = /^bytes=(\d*)-(\d*)$/u.exec(request.headers.range ?? '')
      const start = range ? range[1] ? Number(range[1]) : Math.max(0, bytes.length - Number(range[2])) : 0
      const end = range?.[1] && range[2] ? Math.min(bytes.length - 1, Number(range[2])) : bytes.length - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= bytes.length) {
        response.writeHead(416, { ...headers, 'content-range': `bytes */${bytes.length}` })
        response.end()
        return
      }
      const body = bytes.subarray(start, end + 1)
      response.writeHead(range ? 206 : 200, { ...headers, 'content-length': body.length, ...(range ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {}) })
      response.end(request.method === 'HEAD' ? undefined : body)
    }
    catch {
      response.writeHead(404)
      response.end()
    }
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()!
  if (typeof address === 'string')
    throw new Error('Invalid player server')
  return { url: `http://127.0.0.1:${address.port}`, async close() {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  } }
}
