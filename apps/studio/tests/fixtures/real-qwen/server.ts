import type { AdvConfig, AdvVoiceCandidate, AdvVoiceProvider, AdvVoiceSynthesisProvider, AdvVoiceSynthesisRequest } from '@advjs/types'
import type { Buffer } from 'node:buffer'
import type { StudioAudioPublicationPort } from '../../../../../packages/advjs/node/audio/server'
import { createHash, randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { audioProjectMediaPath, canonicalAudioJson, createAudioId, parseAudioToolchainLock } from '@advjs/audio'
import JSZip from 'jszip'
import { createLocalVoiceServiceOptions } from '../../../../../packages/advjs/node/audio/local-session'
import { createStudioVoiceService } from '../../../../../packages/advjs/node/audio/server'
import { createNodeVoiceAuthoringService } from '../../../../../packages/advjs/node/audio/voice'
import { loadProject } from '../../../../../packages/advjs/node/project'
import { defaultRealQwenRoot, inspectRealQwenWav, REAL_QWEN_MODELS, REAL_QWEN_PRESETS, REAL_QWEN_RECEIPT, verifyRealQwenCandidate } from '../../../../../scripts/prepare-real-qwen.mjs'
import { assertRealQwenPreparedProject } from '../../../../../tests/fixtures/audio/editor-real-qwen'
import { buildStudioNativeHandoff } from '../design-flow/handoff'

function within(root: string, path: string) {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}
async function hashFile(path: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path))
    hash.update(chunk)
  return hash.digest('hex')
}

/** Opt-in only. Reuses the prepared environment; never setup/download/auto-run. */
export async function startStudioRealQwenFixture() {
  if (process.env.ADVJS_REAL_QWEN !== '1')
    throw new Error('REAL_QWEN_OPT_IN_REQUIRED')
  const root = await realpath(defaultRealQwenRoot())
  const receipt = JSON.parse(await readFile(join(root, REAL_QWEN_RECEIPT), 'utf8'))
  const marker = JSON.parse(await readFile(join(root, '.advjs/voice/real-qwen-project.json'), 'utf8'))
  assertRealQwenPreparedProject(root, marker, receipt)
  // Verify actual pinned bytes before replacing even finite acceptance sources.
  for (const model of Object.values(REAL_QWEN_MODELS)) {
    const snapshot = join(root, '.advjs/voice/huggingface/hub', `models--${model.model.replaceAll('/', '--')}`, 'snapshots', model.revision)
    for (const [name, sha256] of Object.entries(model.weightSha256)) {
      const path = await realpath(join(snapshot, name))
      if (!within(join(root, '.advjs/voice/huggingface'), path) || await hashFile(path) !== sha256)
        throw new Error('REAL_QWEN_MODEL_CHANGED')
    }
  }
  for (const [kind, presetPath] of Object.entries(REAL_QWEN_PRESETS)) {
    const preset = JSON.parse(await readFile(join(root, presetPath), 'utf8'))
    const expected = REAL_QWEN_MODELS[kind as keyof typeof REAL_QWEN_MODELS]
    if (preset.model !== expected.model || preset.revision !== expected.revision || canonicalAudioJson(preset.weightSha256) !== canonicalAudioJson(expected.weightSha256))
      throw new Error('REAL_QWEN_TRUSTED_PRESET_CHANGED')
  }
  const referencePath = await realpath(join(root, receipt.reference.path))
  if (!within(root, referencePath) || await hashFile(referencePath) !== receipt.reference.sha256)
    throw new Error('REAL_QWEN_REFERENCE_CHANGED')
  const module = await import(pathToFileURL(resolve(import.meta.dirname, '../../../../../plugins/plugin-qwen-tts/dist/index.mjs')).href) as { createQwenTtsProvider: () => AdvVoiceProvider & AdvVoiceSynthesisProvider }
  const provider = module.createQwenTtsProvider()
  const doctor = await provider.doctor({ root })
  if (!doctor.ready)
    throw new Error('REAL_QWEN_RUNTIME_NOT_READY')
  const runId = Date.now().toString(36)
  const artifactRoot = resolve(process.env.ADVJS_REAL_QWEN_ARTIFACTS ?? join(tmpdir(), 'advjs-studio-real-qwen-artifacts'))
  const directory = join(artifactRoot, runId)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const publicationEnabled = process.env.ADVJS_REAL_QWEN_COS_PUBLISH === '1'
  let operator: { toolchainLock: unknown, default: (context: { accountId: string, projectId: string, root: string, stateDirectory: string }) => Promise<StudioAudioPublicationPort> } | undefined
  if (publicationEnabled) {
    const modulePath = process.env.ADVJS_REAL_QWEN_PUBLICATION_MODULE
    if (!modulePath || !isAbsolute(modulePath))
      throw new Error('REAL_QWEN_PUBLICATION_OPERATOR_REQUIRED')
    const trustedPath = await realpath(modulePath)
    if (within(root, trustedPath))
      throw new Error('REAL_QWEN_PUBLICATION_OPERATOR_MUST_STAY_OUTSIDE_PROJECT')
    operator = await import(pathToFileURL(trustedPath).href)
    if (typeof operator?.default !== 'function')
      throw new Error('REAL_QWEN_PUBLICATION_OPERATOR_INVALID')
  }
  const actorId = `studio-real-${runId}`
  const lineId = createAudioId('line')
  const previewText = '你好，这是我的原创声音。今天的阳光很温暖，让我们怀着平静的心情，一起开始新的旅程。'
  const dialogueText = '你好，我们一起出发吧。'
  const rightsPath = `authoring/rights/studio-real-${runId}.json`
  const existingGame = JSON.parse(await readFile(join(root, 'adv/settings/game.json'), 'utf8'))
  const filesToWrite: Record<string, unknown> = {
    'adv.config.json': { schemaVersion: 1, id: `studio-real-${runId}`, root: 'adv', format: 'flow', theme: 'default', entryChapterId: 'intro' },
    'adv/settings/game.json': { ...existingGame, title: 'Studio 真实 Qwen 声音与分支', locale: 'zh-CN', entryChapterId: 'intro', variables: { routeEnabled: true }, characters: [...(existingGame.characters ?? []), { id: actorId, name: 'Studio 原创角色' }], chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }, { id: 'outcomes', sources: ['chapters/outcomes.chapter.json'] }] },
    'adv/chapters/intro.chapter.json': { schemaVersion: 1, id: 'intro', title: 'Studio 真实配音', startNodeId: 'speech', notes: { retained: 'real-qwen-layout-proof' }, nodes: [
      { id: 'speech', type: 'dialogues', dialogues: [{ speakerId: actorId, text: '你好。', lineId, actorNote: 'retain-real-line-proof' }], next: 'route' },
      { id: 'route', type: 'choices', next: null, choices: [{ id: 'left', text: '走左侧', when: 'routeEnabled == false', target: 'outcomes#right-end' }, { id: 'right', text: '走右侧', target: 'outcomes#right-end' }] },
    ] },
    'adv/chapters/outcomes.chapter.json': { schemaVersion: 1, id: 'outcomes', title: '分支结果', startNodeId: 'left-end', nodes: [
      { id: 'left-end', type: 'narration', text: '进入左侧分支。', lineId: createAudioId('line'), next: 'end' },
      { id: 'right-end', type: 'narration', text: '进入右侧分支。', lineId: createAudioId('line'), next: 'end' },
      { id: 'end', type: 'end', next: null },
    ] },
    [rightsPath]: { schemaVersion: 1, source: 'synthetic-qwen-voice-design', humanVoice: false, humanConsentClaimed: false, purpose: 'Local ADV.JS Studio acceptance conditioning only. Original AI-synthesized fictional voice; no impersonation or human recording.', transcript: previewText, rights: { license: 'synthetic-acceptance-only', subject: 'ADV.JS Studio original synthetic Qwen voice', consentRecord: rightsPath } },
  }
  if (operator)
    filesToWrite['adv/audio/toolchain.json'] = parseAudioToolchainLock(operator.toolchainLock)
  for (const [path, content] of Object.entries(filesToWrite)) {
    const old = await readFile(join(root, path)).catch((error) => {
      if (error.code !== 'ENOENT')
        throw error
      return undefined
    })
    if (old) {
      const backup = join(directory, 'prior-native', path)
      await mkdir(dirname(backup), { recursive: true })
      await writeFile(backup, old)
    }
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), `${JSON.stringify(content, null, 2)}\n`)
  }
  const calls: Array<{ sequence: number, text?: string, character?: string, preset: string, offline: true, manifest: Record<string, unknown>, quality: { sha256: string, bytes: number, nativeSampleRate: number, durationSeconds: number, rms: number, peak: number }, candidates: AdvVoiceCandidate[] }> = []
  const synthesize = provider.synthesize.bind(provider)
  provider.synthesize = async (request: AdvVoiceSynthesisRequest) => {
    const sequence = calls.length + 1
    await writeFile(join(directory, 'progress.json'), JSON.stringify({ sequence, status: 'running', text: request.text, preset: request.preset }))
    const result = await synthesize({ ...request, offline: true })
    const candidate = await verifyRealQwenCandidate(root, result)
    const wav = await readFile(resolve(root, candidate.path))
    const quality = inspectRealQwenWav(wav)
    let peak = 0
    for (let offset = 12; offset + 8 <= wav.length;) {
      const length = wav.readUInt32LE(offset + 4)
      const content = offset + 8
      if (wav.toString('ascii', offset, offset + 4) === 'data') {
        for (let index = content; index < content + length; index += 2)
          peak = Math.max(peak, Math.abs(wav.readInt16LE(index) / 32768))
      }
      offset = content + length + (length % 2)
    }
    calls.push({ sequence, text: request.text, character: request.character, preset: request.preset, offline: true, manifest: { model: result.manifest.model, revision: result.manifest.revision, generationMode: result.manifest.generationMode, seed: result.manifest.seed }, quality: { sha256: candidate.sha256, bytes: candidate.bytes, nativeSampleRate: quality.sampleRate, durationSeconds: quality.durationSeconds, rms: quality.rms, peak }, candidates: result.candidates })
    await writeFile(join(directory, 'provider-calls.json'), JSON.stringify(calls, null, 2))
    await writeFile(join(directory, 'progress.json'), JSON.stringify({ sequence, status: 'ready' }))
    return result
  }
  const config: Partial<AdvConfig> = { authoring: { voice: { providers: [provider], defaultProvider: provider.id, defaultPreset: 'design', presets: REAL_QWEN_PRESETS } } }
  const pairing = { accessToken: randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 8 * 60 * 60_000).toISOString() }
  const pairingPath = join(directory, 'pairing.json')
  await writeFile(pairingPath, JSON.stringify(pairing), { mode: 0o600, flag: 'wx' })
  const service = await createStudioVoiceService(createLocalVoiceServiceOptions({ ...pairing, port: 3397, stateDirectory: join(directory, 'host-state'), allowedOrigins: ['http://127.0.0.1:3396'], projects: [{ projectId: 'design-flow-project', root, config }], ...(operator ? { publication: context => operator!.default({ ...context, stateDirectory: join(directory, 'release-state') }) } : {}) }))
  await service.start()
  const native = await createNodeVoiceAuthoringService({ root, config })
  const compilation = await loadProject({ root, allowEmptyAssetManifest: true })
  const files: Record<string, string> = { ...compilation.files }
  // Native authoring documents are outside game contentRoot and must survive ZIP.
  const libraryPath = join(root, 'authoring/voices/library.json')
  const library = await readFile(libraryPath, 'utf8').catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
  if (library)
    files['authoring/voices/library.json'] = library
  async function collectJson(directoryPath: string, nativePath: string) {
    for (const entry of await readdir(directoryPath, { withFileTypes: true }).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error))) {
      if (entry.isSymbolicLink())
        throw new Error('REAL_QWEN_AUTHORING_LINK_REFUSED')
      if (entry.isDirectory())
        await collectJson(join(directoryPath, entry.name), `${nativePath}/${entry.name}`)
      else if (entry.name.endsWith('.json'))
        files[`${nativePath}/${entry.name}`] = await readFile(join(directoryPath, entry.name), 'utf8')
    }
  }
  await collectJson(join(root, 'authoring/voices/designs'), 'authoring/voices/designs')
  await collectJson(join(root, 'authoring/rights'), 'authoring/rights')
  const snapshot = await native.read()
  const media = await Promise.all(snapshot.catalog.assets.filter(asset => asset.type === 'audio').map(async (asset) => {
    const path = audioProjectMediaPath(snapshot.catalog, asset)
    const bytes = await readFile(join(root, path))
    if (!asset.sha256 || createHash('sha256').update(bytes).digest('hex') !== asset.sha256 || (asset.bytes !== undefined && asset.bytes !== bytes.length))
      throw new Error('REAL_QWEN_NATIVE_MEDIA_CHANGED')
    return { assetId: asset.id, path, sha256: asset.sha256, bytes: bytes.length, mimeType: asset.mimeType ?? 'audio/wav' }
  }))
  const exports: Array<Record<string, any> & { close: () => Promise<void> }> = []
  async function handoff(buffer: Buffer) {
    if (buffer.length > 64 * 1024 * 1024)
      throw new Error('REAL_QWEN_EXPORT_LIMIT')
    await writeFile(join(directory, `handoff-${exports.length + 1}.zip`), buffer)
    const zip = await JSZip.loadAsync(buffer)
    const exportRoot = await mkdtemp(join(tmpdir(), 'advjs-studio-real-qwen-export-'))
    const paths: string[] = []
    let total = 0
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || entry.name === 'manifest.json')
        continue
      if (entry.name.startsWith('/') || entry.name.includes('\\') || entry.name.split('/').some(part => ['.', '..', 'node_modules', '.advjs'].includes(part)))
        throw new Error('REAL_QWEN_EXPORT_PATH_INVALID')
      const bytes = await entry.async('nodebuffer')
      total += bytes.length
      if (total > 128 * 1024 * 1024)
        throw new Error('REAL_QWEN_EXPORT_LIMIT')
      const path = join(exportRoot, entry.name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
      paths.push(entry.name)
    }
    await writeFile(join(exportRoot, 'package.json'), JSON.stringify({ private: true, type: 'module', name: 'studio-real-qwen-handoff', dependencies: { 'advjs': 'workspace:*', '@advjs/theme-default': 'workspace:*' } }))
    await symlink(resolve(import.meta.dirname, '../../../../../node_modules'), join(exportRoot, 'node_modules'), 'dir')
    const checked = await loadProject({ root: exportRoot, allowEmptyAssetManifest: true })
    const player = await buildStudioNativeHandoff(exportRoot)
    const binding = (await native.read()).ledger.lines[lineId]?.locales['zh-CN']
    const take = binding?.takes.find(take => take.id === binding.selectedTake)
    if (!take)
      throw new Error('REAL_QWEN_EXPORT_SELECTED_TAKE_REQUIRED')
    const result = { ...player, root: exportRoot, diagnostics: checked.result.diagnostics, chapterIds: checked.result.project.chapters.map(chapter => chapter.id), files: paths.sort(), take, lineId, text: dialogueText }
    exports.push(result)
    const { close: _, ...proof } = result
    await writeFile(join(directory, `handoff-${exports.length}.json`), JSON.stringify(proof, null, 2))
    return proof
  }
  const metadata = { runId, root, directory, sessionMode: 'local-pairing', publicationEnabled, actorId, lineId, previewText, dialogueText, rightsPath, designedVoiceId: `studio-real-designed-${runId}`, clonedVoiceId: `studio-real-cloned-${runId}`, providerId: provider.id, models: REAL_QWEN_MODELS }
  await writeFile(join(directory, 'metadata.json'), JSON.stringify(metadata, null, 2))
  return {
    files,
    media,
    metadata,
    async mediaBytes(assetId: string) {
      const item = media.find(item => item.assetId === assetId)
      if (!item)
        throw new Error('REAL_QWEN_NATIVE_MEDIA_MISSING')
      const bytes = await readFile(join(root, item.path))
      if (createHash('sha256').update(bytes).digest('hex') !== item.sha256)
        throw new Error('REAL_QWEN_NATIVE_MEDIA_CHANGED')
      return { bytes, mimeType: item.mimeType }
    },
    handoff,
    async status() {
      return { calls, snapshot: await native.read(), exports: exports.map(({ close: _, ...proof }) => proof) }
    },
    async close() {
      for (const item of exports)
        await item.close()
      await service.stop()
      await rm(pairingPath, { force: true })
      // Native history, exported proofs, model cache and isolated venv persist.
    },
  }
}
