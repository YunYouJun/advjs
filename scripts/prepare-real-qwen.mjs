#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto'
import { appendFileSync, createReadStream } from 'node:fs'
import { mkdir, readdir, readFile, realpath, rename, stat, statfs, writeFile } from 'node:fs/promises'
import { homedir, totalmem } from 'node:os'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const projectMarker = '.advjs/voice/real-qwen-project.json'
export const REAL_QWEN_RECEIPT = '.advjs/voice/real-qwen-ready.json'
export const REAL_QWEN_MODELS = Object.freeze({
  design: Object.freeze({
    model: 'mlx-community/Qwen3-TTS-12Hz-1.7B-VoiceDesign-bf16',
    revision: '7d3824abff87e49756bb0f83fb5411de75d160c4',
    weightSha256: Object.freeze({
      'model.safetensors': '96ae28bec2205ec0b5e0c750bea2b8a5deac4f14d33a8a25a5f753299486b70e',
      'speech_tokenizer/model.safetensors': '836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258',
    }),
  }),
  base: Object.freeze({
    model: 'mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16',
    revision: 'a6eb4f68e4b056f1215157bb696209bc82a6db48',
    weightSha256: Object.freeze({
      'model.safetensors': '81fb76175ff74e69be25fef2cc3e54f016df3034f1514c8e1c89da06a3510cff',
      'speech_tokenizer/model.safetensors': '836b7b357f5ea43e889936a3709af68dfe3751881acefe4ecf0dbd30ba571258',
    }),
  }),
})
export const REAL_QWEN_PRESETS = Object.freeze({ design: 'authoring/voices/operator-design.json', base: 'authoring/voices/operator-base.json' })
const originalText = '这是一段由本地语音模型原创合成的测试声音。欢迎来到冒险世界，让我们一起验证配音效果。'
const baseText = '这个角色的声音保持稳定，我们开始新的故事。'
const description = '年轻成年女性，温暖清晰的普通话声音，语气平静自然，表达友好，不模仿任何真实人物。'

export function defaultRealQwenRoot(env = process.env, platform = process.platform, home = homedir()) {
  if (env.ADVJS_REAL_QWEN_ROOT)
    return resolve(env.ADVJS_REAL_QWEN_ROOT)
  const cache = platform === 'darwin' ? resolve(home, 'Library/Caches') : platform === 'win32' ? resolve(env.LOCALAPPDATA ?? resolve(home, 'AppData/Local')) : resolve(env.XDG_CACHE_HOME ?? resolve(home, '.cache'))
  return resolve(cache, 'ADV.JS/real-qwen-20261011')
}

export function parseRealQwenArgs(args, env = process.env) {
  let action = env.ADVJS_REAL_QWEN === '1' ? 'prepare' : 'help'
  let root = defaultRealQwenRoot(env)
  let explicit = false
  for (let index = 0; index < args.length; index++) {
    const value = args[index]
    if (['prepare', 'doctor', 'list'].includes(value)) {
      action = value
      explicit = value === 'prepare'
    }
    else if (value === '--root' && args[index + 1]) {
      root = resolve(args[++index])
    }
    else {
      throw new Error('REAL_QWEN_ARGUMENT_INVALID')
    }
  }
  return { action, root, explicit, env }
}

function inside(root, path) {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}
async function optionalJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  }
  catch (error) {
    if (error.code === 'ENOENT')
      return undefined
    throw error
  }
}
async function jsonWrite(path, value) {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
  await rename(temporary, path)
}
async function fileHash(path) {
  const digest = createHash('sha256')
  for await (const chunk of createReadStream(path))
    digest.update(chunk)
  return digest.digest('hex')
}

export function inspectRealQwenWav(bytes) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error('REAL_QWEN_WAV_INVALID')
  let format
  let pcm
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const length = bytes.readUInt32LE(offset + 4)
    const content = offset + 8
    if (content + length > bytes.length)
      throw new Error('REAL_QWEN_WAV_INVALID')
    const name = bytes.toString('ascii', offset, offset + 4)
    if (name === 'fmt ' && length >= 16)
      format = { encoding: bytes.readUInt16LE(content), channels: bytes.readUInt16LE(content + 2), sampleRate: bytes.readUInt32LE(content + 4), sampleBits: bytes.readUInt16LE(content + 14) }
    if (name === 'data')
      pcm = bytes.subarray(content, content + length)
    offset = content + length + (length % 2)
  }
  if (!format || format.encoding !== 1 || format.channels !== 1 || format.sampleBits !== 16 || format.sampleRate !== 24000 || !pcm?.length || pcm.length % 2)
    throw new Error('REAL_QWEN_WAV_INVALID')
  let squares = 0
  for (let offset = 0; offset < pcm.length; offset += 2)
    squares += (pcm.readInt16LE(offset) / 32768) ** 2
  const rms = Math.sqrt(squares / (pcm.length / 2))
  if (!Number.isFinite(rms) || rms <= 1e-5)
    throw new Error('REAL_QWEN_WAV_SILENT')
  return { sampleRate: format.sampleRate, durationSeconds: pcm.length / 2 / format.sampleRate, rms }
}

export async function verifyRealQwenCandidate(root, result) {
  const candidate = result.candidates?.[0]
  if (!candidate || result.candidates.length !== 1)
    throw new Error('REAL_QWEN_CANDIDATE_INVALID')
  const path = await realpath(resolve(root, candidate.path))
  if (!inside(root, path))
    throw new Error('REAL_QWEN_CANDIDATE_PATH_INVALID')
  const bytes = await readFile(path)
  if (bytes.length !== candidate.bytes || createHash('sha256').update(bytes).digest('hex') !== candidate.sha256)
    throw new Error('REAL_QWEN_CANDIDATE_CHANGED')
  return { ...candidate, ...inspectRealQwenWav(bytes), manifestPath: result.manifestPath }
}

async function runtime() {
  const [{ createQwenTtsProvider }, commands] = await Promise.all([
    import('../plugins/plugin-qwen-tts/dist/index.mjs'),
    import('../packages/advjs/dist/node/index.mjs'),
  ])
  return { ...commands, provider: createQwenTtsProvider() }
}
export function realQwenConfig(provider) {
  return { id: 'real-qwen-acceptance', format: 'flow', root: 'adv', authoring: { voice: { provider, presets: REAL_QWEN_PRESETS, defaultPreset: 'design', defaultReferenceMode: 'icl', assetManifest: 'adv/assets.json' } } }
}

export async function initializeRealQwenProject(root) {
  if (inside(repositoryRoot, root))
    throw new Error('REAL_QWEN_DEDICATED_PROJECT_REQUIRED')
  await mkdir(root, { recursive: true })
  root = await realpath(root)
  if (inside(repositoryRoot, root))
    throw new Error('REAL_QWEN_DEDICATED_PROJECT_REQUIRED')
  const marker = await optionalJson(resolve(root, projectMarker))
  if (marker) {
    if (marker.schemaVersion !== 1 || marker.kind !== 'advjs-real-qwen-acceptance' || marker.root !== root)
      throw new Error('REAL_QWEN_DEDICATED_PROJECT_REQUIRED')
    return root
  }
  if ((await readdir(root)).length)
    throw new Error('REAL_QWEN_EXISTING_PROJECT_REFUSED')
  await jsonWrite(resolve(root, projectMarker), { schemaVersion: 1, kind: 'advjs-real-qwen-acceptance', root })
  await jsonWrite(resolve(root, 'adv.config.json'), { schemaVersion: 1, id: 'real-qwen-acceptance', format: 'flow', root: 'adv', entryChapterId: 'intro' })
  await jsonWrite(resolve(root, 'adv/settings/game.json'), { id: 'real-qwen-acceptance', title: '真实 Qwen 本地验收', locale: 'zh-CN', entryChapterId: 'intro', characters: [{ id: 'hero', name: '验收角色' }] })
  await jsonWrite(resolve(root, 'adv/chapters/intro.chapter.json'), { schemaVersion: 1, id: 'intro', title: '真实配音', startNodeId: 'welcome', nodes: [{ id: 'welcome', type: 'dialogues', dialogues: [{ speakerId: 'hero', text: '欢迎来到冒险世界，让我们一起验证真实配音。', lineId: 'line_01a12ed0-7b00-7000-8000-000000000001' }] }] })
  await jsonWrite(resolve(root, 'adv/assets.json'), { schemaVersion: 2, id: 'real-qwen-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] })
  return root
}

async function verifyWeights(root) {
  for (const { model, revision, weightSha256 } of Object.values(REAL_QWEN_MODELS)) {
    const snapshot = resolve(root, '.advjs/voice/huggingface/hub', `models--${model.replaceAll('/', '--')}`, 'snapshots', revision)
    for (const [name, expected] of Object.entries(weightSha256)) {
      const path = await realpath(resolve(snapshot, name))
      if (!inside(resolve(root, '.advjs/voice/huggingface'), path) || await fileHash(path) !== expected)
        throw new Error('REAL_QWEN_MODEL_CHANGED')
    }
  }
}

export async function prepareRealQwen(options) {
  const action = options.action ?? 'prepare'
  if (action === 'help')
    return { usage: 'node scripts/prepare-real-qwen.mjs prepare [--root <dedicated-project>]; doctor/list are read-only' }
  if (action === 'prepare' && !options.explicit && (options.env ?? process.env).ADVJS_REAL_QWEN !== '1')
    throw new Error('REAL_QWEN_OPT_IN_REQUIRED')
  if (!['prepare', 'doctor', 'list'].includes(action))
    throw new Error('REAL_QWEN_ARGUMENT_INVALID')
  const selected = options.runtime ?? await runtime()
  let root = resolve(options.root ?? defaultRealQwenRoot(options.env))
  const config = realQwenConfig(selected.provider)
  if (action === 'doctor')
    return await selected.runVoiceDoctor({ root, config })
  if (action === 'list')
    return await selected.runVoicePreview({ root, config, preset: 'design', character: 'hero', list: true })
  if (process.platform !== 'darwin' || process.arch !== 'arm64' || totalmem() < 16 * 1024 ** 3)
    throw new Error('REAL_QWEN_APPLE_SILICON_16GB_REQUIRED')
  root = await initializeRealQwenProject(root)
  const logPath = resolve(root, '.advjs/voice/real-qwen-prepare.log')
  const onProgress = message => appendFileSync(logPath, message, { mode: 0o600 })
  const old = await optionalJson(resolve(root, REAL_QWEN_RECEIPT))
  await selected.runVoiceSetup({ root, config, onProgress })
  const doctor = await selected.runVoiceDoctor({ root, config })
  if (!doctor.ready)
    throw new Error('REAL_QWEN_RUNTIME_NOT_READY')
  if (old) {
    if (old.schemaVersion !== 1 || old.status !== 'ready' || old.kind !== 'advjs-real-qwen-acceptance' || old.root !== root || old.providerId !== 'qwen-tts' || JSON.stringify(old.models) !== JSON.stringify(REAL_QWEN_MODELS))
      throw new Error('REAL_QWEN_RECEIPT_INVALID')
    await verifyWeights(root)
    const reference = await realpath(resolve(root, old.reference.path))
    if (!inside(root, reference) || await fileHash(reference) !== old.reference.sha256)
      throw new Error('REAL_QWEN_REFERENCE_CHANGED')
    for (const [candidate, model, text] of [[old.designCandidate, REAL_QWEN_MODELS.design, originalText], [old.baseCandidate, REAL_QWEN_MODELS.base, baseText]]) {
      if (candidate.provider !== 'qwen-tts' || candidate.model !== model.model || candidate.revision !== model.revision || candidate.text !== text)
        throw new Error('REAL_QWEN_RECEIPT_INVALID')
      await verifyRealQwenCandidate(root, { candidates: [candidate], manifestPath: candidate.manifestPath })
    }
    return { ...old, doctor, reused: true }
  }
  const disk = await statfs(root)
  if (Number(disk.bavail) * Number(disk.bsize) < 12 * 1024 ** 3)
    throw new Error('REAL_QWEN_12GB_DISK_REQUIRED')
  const progressPath = resolve(root, '.advjs/voice/real-qwen-progress.json')
  const progress = await optionalJson(progressPath) ?? {}
  if (!progress.design) {
    await jsonWrite(resolve(root, REAL_QWEN_PRESETS.design), { version: 'real-qwen-design-v1', ...REAL_QWEN_MODELS.design, language: 'Chinese', characters: [{ id: 'hero', name: '验收角色', text: originalText, description }, { id: 'narrator', text: originalText, description }] })
    progress.design = await selected.runVoicePreview({ root, config, preset: 'design', character: 'hero', text: originalText, seed: 42, onProgress })
    await jsonWrite(progressPath, progress)
  }
  const designCandidate = await verifyRealQwenCandidate(root, progress.design)
  if (designCandidate.provider !== 'qwen-tts' || designCandidate.model !== REAL_QWEN_MODELS.design.model || designCandidate.revision !== REAL_QWEN_MODELS.design.revision || designCandidate.text !== originalText)
    throw new Error('REAL_QWEN_CANDIDATE_INVALID')
  if (designCandidate.durationSeconds < 3 || designCandidate.durationSeconds > 20)
    throw new Error('REAL_QWEN_REFERENCE_DURATION_INVALID')
  const rights = { license: 'synthetic-acceptance-only', subject: 'ADV.JS synthetic Qwen acceptance voice', consentRecord: 'authoring/rights/qwen-synthetic-reference.json' }
  const reference = { assetId: 'audio_01a12ed0-7b00-7000-8000-000000000002', path: 'public/media/voice/reference/qwen-original.wav', sha256: designCandidate.sha256, bytes: designCandidate.bytes, durationSeconds: designCandidate.durationSeconds, sampleRate: designCandidate.sampleRate, text: originalText, source: 'synthetic-qwen-voice-design', rights }
  await mkdir(dirname(resolve(root, reference.path)), { recursive: true })
  const existingReference = await stat(resolve(root, reference.path)).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
  if (!existingReference)
    await writeFile(resolve(root, reference.path), await readFile(resolve(root, designCandidate.path)), { flag: 'wx', mode: 0o600 })
  if (await fileHash(resolve(root, reference.path)) !== reference.sha256)
    throw new Error('REAL_QWEN_REFERENCE_CHANGED')
  await jsonWrite(resolve(root, rights.consentRecord), { schemaVersion: 1, source: reference.source, humanVoice: false, humanConsentClaimed: false, purpose: 'Local ADV.JS E2E conditioning only; original AI-synthesized text and audio, not an impersonation or human recording.', model: designCandidate.model, revision: designCandidate.revision, audioSha256: reference.sha256, transcript: originalText, rights })
  const catalog = await optionalJson(resolve(root, 'adv/assets.json'))
  if (catalog?.schemaVersion !== 2 || !Array.isArray(catalog.assets) || catalog.includes)
    throw new Error('REAL_QWEN_INITIAL_CATALOG_REQUIRED')
  const asset = { id: reference.assetId, type: 'audio', kind: 'reference', characterId: 'hero', path: 'voice/reference/qwen-original.wav', sha256: reference.sha256, bytes: reference.bytes, duration: reference.durationSeconds, mimeType: 'audio/wav', license: rights.license, state: 'candidate', source: { type: 'generated', model: designCandidate.model } }
  const oldAsset = catalog.assets.find(item => item.id === reference.assetId)
  if (oldAsset && (oldAsset.sha256 !== asset.sha256 || oldAsset.path !== asset.path || oldAsset.kind !== asset.kind))
    throw new Error('REAL_QWEN_REFERENCE_CHANGED')
  if (!oldAsset)
    await jsonWrite(resolve(root, 'adv/assets.json'), { ...catalog, assets: [...catalog.assets, asset] })
  if (!progress.base) {
    await jsonWrite(resolve(root, REAL_QWEN_PRESETS.base), { version: 'real-qwen-base-v1', ...REAL_QWEN_MODELS.base, language: 'Chinese', characters: [{ id: 'hero', text: baseText, reference: { assetId: reference.assetId, sha256: reference.sha256, text: originalText } }] })
    progress.base = await selected.runVoicePreview({ root, config, preset: 'base', character: 'hero', seed: 42, referenceMode: 'icl', onProgress })
    await jsonWrite(progressPath, progress)
  }
  const baseCandidate = await verifyRealQwenCandidate(root, progress.base)
  if (baseCandidate.provider !== 'qwen-tts' || baseCandidate.model !== REAL_QWEN_MODELS.base.model || baseCandidate.revision !== REAL_QWEN_MODELS.base.revision || baseCandidate.text !== baseText)
    throw new Error('REAL_QWEN_CANDIDATE_INVALID')
  await verifyWeights(root)
  const result = { schemaVersion: 1, status: 'ready', kind: 'advjs-real-qwen-acceptance', preparedAt: new Date().toISOString(), root, providerId: 'qwen-tts', presetsMap: REAL_QWEN_PRESETS, models: REAL_QWEN_MODELS, doctor: await selected.runVoiceDoctor({ root, config }), environmentDirectory: doctor.environmentDirectory, modelCacheDirectory: doctor.modelCacheDirectory, designCandidate, baseCandidate, reference, offline: true, apiCost: 0 }
  await jsonWrite(resolve(root, REAL_QWEN_RECEIPT), result)
  return result
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    const result = await prepareRealQwen(parseRealQwenArgs(process.argv.slice(2)))
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'REAL_QWEN_PREPARE_FAILED'}\n`)
    process.exitCode = 1
  }
}
