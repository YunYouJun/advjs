import type { AdvVoiceCandidate, AdvVoiceSynthesisProvider, AdvVoiceSynthesisRequest, CharacterVoiceProfile, JsonObject, VoiceManagedInstallation } from '@advjs/types'
import type { BreezeAlignmentOptions } from './alignment'
import type { BreezeReference } from './reference'
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import { voiceAlignmentUnresolvedCharacters } from '@advjs/audio'
import { createBreezeAligner } from './alignment'
import { referenceBytes } from './reference'
import { inspectWave, outputDirectory, projectFile, responseBytes } from './runtime'

const providerId = 'breeze-tts'
const model = 'Breeze-TTS-2'
const maximumText = 500

/** Trusted Node host options; endpoints and credentials never come from a design. */
export interface BreezeTtsProviderOptions {
  baseUrl?: string
  modelUid?: string
  fetch?: typeof globalThis.fetch
  alignment?: BreezeAlignmentOptions
  installation?: VoiceManagedInstallation
}

function object(value: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key)))
    throw new Error(`${label} must be a JSON object with supported fields`)
  return value as Record<string, unknown>
}

function text(value: unknown, label: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || Array.from(value).length > maximum)
    throw new Error(`${label} must contain 1 to ${maximum} characters`)
  return value
}

function parameters(config: Record<string, unknown>, seedOverride?: number) {
  const seed = seedOverride ?? config.seed ?? 42
  const cfgScale = config.cfgScale ?? 4
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF)
    throw new Error('Breeze seed must be an unsigned 32-bit integer')
  if (typeof cfgScale !== 'number' || !Number.isFinite(cfgScale) || cfgScale <= 0)
    throw new Error('Breeze cfgScale must be finite and greater than zero')
  return { seed, cfgScale }
}

function instructions(description: string, intent: CharacterVoiceProfile['intent']): string {
  const directions = [
    ['年龄印象', intent.ageImpression],
    ['性别表达', intent.genderExpression],
    ['气质与情绪', intent.temperament?.join('，')],
    ['说话风格', intent.speakingStyle],
    ['音高', intent.pitch && { low: '低', medium: '中', high: '高' }[intent.pitch]],
    ['语速', intent.pace && { slow: '慢', medium: '适中', fast: '快' }[intent.pace]],
  ].filter(([, value]) => value?.trim()).map(([label, value]) => `${label}：${value!.trim()}`)
  return directions.length ? `${description}\n${directions.join('；')}` : description
}

async function preset(request: AdvVoiceSynthesisRequest) {
  request.signal?.throwIfAborted()
  if (request.text !== undefined && !request.character)
    throw new Error('A text override requires one character')
  const root = await realpath(request.root)
  const configPath = await projectFile(root, request.configPath)
  if ((await stat(configPath)).size > 1024 * 1024)
    throw new Error('Breeze preset exceeds the size limit')
  const source = await readFile(configPath, 'utf8')
  let value: unknown
  try {
    value = JSON.parse(source)
  }
  catch {
    throw new Error('Breeze preset must contain valid JSON')
  }
  const config = object(value, ['schemaVersion', 'model', 'seed', 'cfgScale', 'instruct', 'characters'], 'Breeze preset')
  if (config.schemaVersion !== 1 || config.model !== model || !Array.isArray(config.characters) || !config.characters.length)
    throw new Error('Breeze preset requires schemaVersion 1, model Breeze-TTS-2 and characters')
  const generation = parameters(config, request.seed)
  const common = config.instruct === undefined ? undefined : text(config.instruct, 'Breeze direction', 4096)
  const ids = new Set<string>()
  const characters = await Promise.all(config.characters.map(async (value) => {
    const item = object(value, ['id', 'name', 'card', 'text', 'description', 'reference'], 'Breeze character')
    const id = text(item.id, 'Character ID', 128)
    if (!/^[a-z0-9][\w-]*$/iu.test(id) || ids.has(id))
      throw new Error('Breeze character IDs must be unique safe identifiers')
    ids.add(id)
    let reference: BreezeReference | undefined
    if (item.reference !== undefined) {
      const ref = object(item.reference, ['assetId', 'sha256', 'text'], 'Breeze reference')
      const assetId = text(ref.assetId, 'Reference asset ID', 256)
      const sha256 = text(ref.sha256, 'Reference SHA-256', 64)
      if (!/^[a-f0-9]{64}$/u.test(sha256))
        throw new Error('Breeze reference SHA-256 must be a full lowercase hash')
      reference = { assetId, sha256, text: text(ref.text, 'Exact reference transcript', 4096) }
    }
    const description = reference && item.description === undefined ? undefined : text(item.description, 'Voice description', 4096)
    const instruct = text([common, description].filter(Boolean).join('\n') || '保持参考音色，自然清晰地说话。', 'Combined Breeze direction', 4096)
    const card = item.card === undefined ? undefined : text(item.card, 'Character card', 1024)
    if (card)
      await projectFile(root, card)
    return {
      id,
      name: item.name === undefined ? id : text(item.name, 'Character name', 256),
      text: text(request.character === id ? request.text ?? item.text : item.text, 'Target text', maximumText),
      instruct,
      providerVoiceId: reference ? `reference:${reference.assetId}:${reference.sha256}` : `design:${createHash('sha256').update(instruct).digest('hex')}`,
      ...(reference ? { reference } : {}),
      ...(card ? { card } : {}),
    }
  }))
  const selected = characters.filter(item => !request.character || item.id === request.character)
  if (!selected.length)
    throw new Error('Unknown Breeze character')
  const references = selected.filter(item => item.reference)
  if (references.length && references.length !== selected.length)
    throw new Error('A Breeze preview batch cannot mix clone and description designs')
  if (request.referenceMode !== undefined && (!references.length || request.referenceMode !== 'icl'))
    throw new Error('Breeze cloning requires reference audio and transcript (icl); embedding-only is unsupported')
  request.signal?.throwIfAborted()
  return { root, configPath, source, characters: selected, ...generation }
}

/** Reuse the native authoring UI with a loaded, loopback-only Xinference model. */
export function createBreezeTtsProvider(options: BreezeTtsProviderOptions = {}): AdvVoiceSynthesisProvider {
  const base = new URL(options.baseUrl ?? 'http://127.0.0.1:9997')
  if (base.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || base.username || base.password || base.search || base.hash || !['/', '/v1', '/v1/'].includes(base.pathname))
    throw new Error('Breeze requires a local HTTP Xinference baseUrl without credentials')
  const modelUid = text(options.modelUid ?? 'breeze-bf16', 'Xinference model UID', 128)
  const fetcher = options.fetch ?? globalThis.fetch
  const align = options.alignment ? createBreezeAligner(options.alignment) : undefined
  async function call(path: string, init: RequestInit, signal?: AbortSignal) {
    signal?.throwIfAborted()
    try {
      const response = await fetcher(`${base.origin}/v1/${path}`, { ...init, redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(init.method === 'POST' ? 300_000 : 10_000), ...(signal ? [signal] : [])]) })
      if (!response.ok) {
        await response.body?.cancel()
        throw new Error(`HTTP ${response.status}`)
      }
      return response
    }
    catch {
      signal?.throwIfAborted()
      throw new Error('Breeze local service request failed. Start Xinference and load the configured Breeze model; no retry or model download was attempted')
    }
  }
  async function loaded(signal?: AbortSignal) {
    const response = await call(`models/${encodeURIComponent(modelUid)}`, { method: 'GET' }, signal)
    let info: Record<string, unknown>
    try {
      info = JSON.parse((await responseBytes(response, 64 * 1024)).toString())
    }
    catch {
      throw new Error('Invalid Breeze model description from local service')
    }
    if (!info || info.model_type !== 'audio' || info.model_name !== model || info.model_family !== model)
      throw new Error('The configured Xinference UID is not a Breeze-TTS-2 audio model')
  }
  return {
    id: providerId,
    packageName: '@advjs/plugin-breeze-tts',
    installation: options.installation,
    align,
    capabilities: { backend: 'local', synthesis: true, voiceCreation: false, offline: true, alignment: Boolean(align), designSources: ['designed', 'cloned'], referenceModes: ['icl'], models: [{ id: model, modes: ['voice-design', 'icl'], maxTextCharacters: maximumText, formats: ['audio/wav'], streaming: false }] },
    async buildDesignPreset({ template, characterId, text: sample, locale, intent, definition }) {
      if (template.model !== model || !['designed', 'cloned'].includes(definition.source))
        throw new Error('VOICE_DESIGN_SOURCE_UNSUPPORTED')
      let supported = false
      try {
        supported = new Intl.Locale(locale).language === 'zh'
      }
      catch { /* Invalid locales do not fall back to Chinese. */ }
      if (!supported)
        throw new Error('VOICE_DESIGN_LOCALE_UNSUPPORTED')
      if (definition.source === 'cloned') {
        if (!definition.reference || !definition.rights)
          throw new Error('VOICE_DESIGN_REFERENCE_RIGHTS_REQUIRED')
        if (definition.reference.mode !== undefined && definition.reference.mode !== 'icl')
          throw new Error('VOICE_DESIGN_REFERENCE_MODE_UNSUPPORTED')
        const transcript = text(definition.reference.text, 'Exact reference transcript', 4096)
        const direction = instructions('', intent).trim()
        return { ...template, characters: [{ id: characterId, text: sample, reference: { assetId: definition.reference.assetId, sha256: definition.reference.sha256, text: transcript }, ...(direction ? { description: text(direction, 'Voice direction', 4096) } : {}) }] }
      }
      const description = text(definition.description, 'Voice description', 4096)
      return { ...template, characters: [{ id: characterId, text: sample, description: text(instructions(description, intent), 'Voice direction', 4096) }] }
    },
    async doctor(context) {
      context.signal?.throwIfAborted()
      try {
        await loaded(context.signal)
        return { provider: providerId, supported: true, ready: true, checks: [{ id: 'loaded-model', status: 'pass', message: 'The configured local Breeze model is loaded; weight precision and revision remain the operator’s responsibility' }] }
      }
      catch {
        context.signal?.throwIfAborted()
        return { provider: providerId, supported: true, ready: false, checks: [{ id: 'loaded-model', status: 'fail', message: 'Start the local Xinference service and load Breeze-TTS-2 with the configured model UID' }] }
      }
    },
    async inspectPreset(request) {
      const input = await preset(request)
      const hasReference = input.characters.some(character => character.reference)
      return { presetSha256: createHash('sha256').update(input.source).digest('hex'), seed: input.seed, requiresReferenceAssets: hasReference, ...(hasReference ? { referenceMode: 'icl' } : {}), characters: input.characters.map(({ id, name, text, card, instruct, providerVoiceId, reference }) => ({ id, name, text, ...(card ? { card } : {}), ...(reference ? { referenceAssetId: reference.assetId } : {}), generation: { model, providerVoiceId, source: reference ? 'cloned' as const : 'designed' as const, mimeType: 'audio/wav', ...(reference ? { referenceAssetId: reference.assetId, referenceSha256: reference.sha256 } : {}), parameters: { instruct, seed: input.seed, cfgScale: input.cfgScale, modelUid, ...(reference ? { referenceText: reference.text, referenceMode: 'icl' } : {}) } } })) }
    },
    async synthesize(request) {
      const input = await preset(request)
      // Validate every reference before any request. Preserve these exact bytes
      // for transport, then recheck native identity after inference completes.
      const references = await Promise.all(input.characters.map(character => character.reference ? referenceBytes({ ...request, root: input.root }, character.reference, character.id) : undefined))
      await loaded(request.signal)
      const directory = resolve(await outputDirectory(input.root), randomUUID())
      await mkdir(directory)
      const candidates: AdvVoiceCandidate[] = []
      const alignmentWarnings: string[] = []
      async function unchanged() {
        request.signal?.throwIfAborted()
        if (await readFile(await projectFile(input.root, request.configPath), 'utf8') !== input.source)
          throw new Error('VOICE_CONFLICT: The Breeze preset changed during synthesis')
        for (const character of input.characters) {
          if (character.reference)
            await referenceBytes({ ...request, root: input.root }, character.reference, character.id)
        }
      }
      try {
        for (const [index, character] of input.characters.entries()) {
          await unchanged()
          const fields = { model: modelUid, input: character.text, voice: 'S0', response_format: 'wav', speed: 1, stream: false, kwargs: JSON.stringify({ instruct: character.instruct, seed: input.seed, cfg_scale: input.cfgScale, ...(character.reference ? { prompt_text: character.reference.text } : {}) }) }
          let init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) }
          const reference = references[index]
          if (reference) {
            const form = new FormData()
            for (const [key, value] of Object.entries(fields))
              form.set(key, String(value))
            form.set('prompt_speech', new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), 'reference.wav')
            init = { method: 'POST', body: form }
          }
          const response = await call('audio/speech', init, request.signal)
          const bytes = await responseBytes(response, 20 * 1024 * 1024)
          const audio = inspectWave(bytes)
          await unchanged()
          const file = resolve(directory, `${character.id}.wav`)
          await writeFile(file, bytes, { flag: 'wx' })
          candidates.push({ id: `${relative(input.root, directory)}:${character.id}`, characterId: character.id, text: character.text, path: relative(input.root, file), sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, mimeType: 'audio/wav', ...audio, provider: providerId, model, providerVoiceId: character.providerVoiceId, ...(request.voiceId ? { voiceId: request.voiceId } : {}), ...(request.voiceVersion ? { voiceVersion: request.voiceVersion } : {}) })
          if (align) {
            const candidate = candidates[candidates.length - 1]!
            try {
              candidate.alignment = await align({ root: input.root, path: candidate.path, text: character.text, sha256: candidate.sha256, durationSeconds: audio.durationSeconds, signal: request.signal })
              const unresolved = voiceAlignmentUnresolvedCharacters(candidate.alignment)
              if (unresolved)
                alignmentWarnings.push(`${character.id}:VOICE_ALIGNMENT_PARTIAL:${unresolved}`)
            }
            catch {
              request.signal?.throwIfAborted()
              alignmentWarnings.push(`${character.id}:VOICE_ALIGNMENT_UNAVAILABLE`)
            }
          }
        }
        await unchanged()
        // Xinference registry revisions can describe another quantization. Do not
        // misrepresent them as the revision of the operator's local weight files.
        const manifest: JsonObject = { schemaVersion: 1, provider: providerId, preset: request.preset, model, modelUid, presetSha256: createHash('sha256').update(input.source).digest('hex'), seed: input.seed, cfgScale: input.cfgScale, state: 'candidate', createdAt: new Date().toISOString(), inputs: input.characters.map(({ id, text, instruct, providerVoiceId, reference }) => ({ characterId: id, text, instruct, providerVoiceId, ...(reference ? { reference: { ...reference } } : {}) })), samples: JSON.parse(JSON.stringify(candidates)) }
        const manifestPath = resolve(directory, 'manifest.json')
        if (alignmentWarnings.length)
          manifest.alignmentWarnings = alignmentWarnings
        await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
        request.signal?.throwIfAborted()
        return { provider: providerId, preset: request.preset, manifestPath: relative(input.root, manifestPath), manifest, candidates }
      }
      catch (error) {
        await rm(directory, { recursive: true, force: true })
        throw error
      }
    },
  }
}
