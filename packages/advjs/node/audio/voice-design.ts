import type { AdvAssetEntry, AdvConfig, AdvVoiceCandidate, AdvVoiceProfile, AdvVoiceSynthesisProvider, JsonObject, VoiceDesignDraft, VoiceDesignFileChange, VoiceDesignMutation, VoiceDesignPort, VoiceDesignPreview, VoiceDesignPreviewInput, VoiceDesignPreviewReview, VoiceDesignProviderInfo, VoiceDesignSample, VoiceDesignSnapshot } from '@advjs/types'
import { createHash, randomUUID } from 'node:crypto'
import { copyFile, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises'
import { addVoiceDesignVersion, applyDesignedVoiceProfile, audioFingerprint, audioProjectMediaPath, canonicalAudioJson, createAudioId, normalizeAudioLocale, parseVoiceDesignDraft, parseVoiceDesignLibrary, VOICE_DESIGN_LIBRARY_PATH, VOICE_DESIGN_PRESET_ROOT, voiceDesignVersion } from '@advjs/audio'
import { applyProjectPatches } from '@advjs/core'
import { isAbsolute, relative, resolve } from 'pathe'
import { resolveAuthoringVoiceContext } from '../commands/voice'
import { applyEditorFileChanges, atomicProjectWrite, projectWriteTarget } from '../editor/mutations'
import { loadProject } from '../project'
import { withProjectWriteLock } from '../project/write-lock'
import { defaultVoiceGenerationStoreDirectory } from './job-store'
import { withVoiceProviderPermit } from './provider-permit'
import { createNodeVoiceAuthoringService } from './voice'
import { createVoiceDesignMirrorValidator } from './voice-design-sync'

const HASH = /^[a-f0-9]{64}$/u
const MAX_MEDIA = 20 * 1024 * 1024
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex')
const encode = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
function fail(code: string): never {
  throw new Error(code)
}
function fields(value: unknown, names: readonly string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => names.includes(key)))
}
function inside(root: string, path: string) {
  const coordinate = relative(root, path)
  return !isAbsolute(coordinate) && coordinate !== '..' && !coordinate.startsWith('../')
}
async function optional(path: string) {
  return await readFile(path, 'utf8').catch(error => error.code === 'ENOENT' ? null : Promise.reject(error))
}

export interface NodeVoiceDesignOptions {
  root: string
  config?: Partial<AdvConfig>
  stateDirectory?: string
  validateProjectAccess?: () => Promise<void>
  verifyProvider?: (providerId: string) => Promise<void>
  withProviderPermit?: <T>(providerId: string, signal: AbortSignal, operation: () => Promise<T>) => Promise<T>
  /** Finite authenticated route prefix supplied by the HTTP host. */
  mediaPrefix?: string
}
interface SavedReview { review: VoiceDesignPreviewReview, executionKey: string, generationHash: string, presetPath: string, voiceVersion: string, modelRevision?: string, mimeType: string, referenceHash?: string, consentHash?: string }
interface SavedPreview { preview: VoiceDesignPreview, reviewId: string, candidate?: AdvVoiceCandidate, registration?: { asset: AdvAssetEntry, sample: VoiceDesignSample, changes: VoiceDesignFileChange[] } }
interface State { schemaVersion: 1, reviews: Record<string, SavedReview>, previews: Record<string, SavedPreview> }

/** The same finite native implementation powers Editor and authenticated Studio services. */
export async function createNodeVoiceDesignHost(options: NodeVoiceDesignOptions): Promise<Omit<VoiceDesignPort, 'readPreviewAudio'> & { readPreviewAudio: (id: string) => Promise<{ bytes: Uint8Array, mimeType: string, sha256: string }>, close: () => Promise<void> }> {
  const root = await realpath(options.root)
  const directory = resolve(options.stateDirectory ?? resolve(defaultVoiceGenerationStoreDirectory(), digest(root), 'voice-design'))
  if (inside(root, directory))
    fail('VOICE_DESIGN_PRIVATE_STATE_REQUIRED')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const privateRoot = await realpath(directory)
  if (inside(root, privateRoot))
    fail('VOICE_DESIGN_PRIVATE_STATE_REQUIRED')
  const statePath = resolve(privateRoot, 'voice-design.json')
  const validateDesignFiles = createVoiceDesignMirrorValidator({ root, config: options.config })
  const controllers = new Map<string, AbortController>()
  const active = new Map<string, Promise<void>>()
  let closed = false
  async function access() {
    if (closed)
      fail('VOICE_DESIGN_HOST_CLOSED')
    await options.validateProjectAccess?.()
  }
  async function state(): Promise<State> {
    const file = await realpath(statePath).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
    if (!file)
      return { schemaVersion: 1, reviews: {}, previews: {} }
    if (!inside(privateRoot, file) || (await stat(file)).size > 4 * 1024 * 1024)
      fail('VOICE_DESIGN_STATE_INVALID')
    const result = JSON.parse(await readFile(file, 'utf8')) as State
    if (result.schemaVersion !== 1 || !result.reviews || !result.previews)
      fail('VOICE_DESIGN_STATE_INVALID')
    return result
  }
  async function mutateState<T>(operation: (document: State) => T) {
    return await withProjectWriteLock(privateRoot, async () => {
      const current = await state()
      const result = operation(current)
      if (Object.keys(current.reviews).length > 200 || Object.keys(current.previews).length > 200 || canonicalAudioJson(current).length > 4 * 1024 * 1024)
        fail('VOICE_DESIGN_STATE_LIMIT')
      await atomicProjectWrite(statePath, encode(current))
      return result
    })
  }
  // An interrupted supplier call has an unknown outcome. Never dispatch it again.
  await mutateState((document) => {
    for (const entry of Object.values(document.previews)) {
      if (entry.preview.status === 'running' || entry.preview.status === 'queued') {
        entry.preview.status = 'unknown'
        entry.preview.error = 'VOICE_DESIGN_OUTCOME_UNKNOWN'
      }
    }
  })
  async function file(coordinate: string, max = 1024 * 1024) {
    if (!coordinate || coordinate.includes('\\') || coordinate.includes(':') || coordinate.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part.toLowerCase())))
      fail('VOICE_DESIGN_PATH_INVALID')
    const path = await realpath(resolve(root, coordinate))
    const info = await stat(path)
    if (!inside(root, path) || !info.isFile() || info.size > max)
      fail('VOICE_DESIGN_PATH_INVALID')
    return { path, bytes: await readFile(path) }
  }
  async function configured(providerId?: string) {
    const loaded = await resolveAuthoringVoiceContext({ root, config: options.config, provider: providerId })
    if (loaded.voice.library && loaded.voice.library !== VOICE_DESIGN_LIBRARY_PATH)
      fail('VOICE_DESIGN_LIBRARY_PATH_UNSUPPORTED')
    return loaded
  }
  async function provider(providerId: string): Promise<AdvVoiceSynthesisProvider> {
    const selected = (await configured(providerId)).provider
    if (!('synthesize' in selected) || !selected.buildDesignPreset || !selected.capabilities.designSources?.length)
      fail('VOICE_DESIGN_CAPABILITY_UNSUPPORTED')
    return selected
  }
  async function inputs() {
    await access()
    const project = await loadProject({ root, allowEmptyAssetManifest: true })
    if (project.result.project.root !== 'adv')
      fail('ADV_AUDIO_CONTENT_ROOT_UNSUPPORTED')
    const authoring = await createNodeVoiceAuthoringService({ root, config: options.config })
    const audio = await authoring.read()
    const libraryPath = await realpath(resolve(root, VOICE_DESIGN_LIBRARY_PATH)).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
    if (libraryPath && !inside(root, libraryPath))
      fail('VOICE_DESIGN_PATH_INVALID')
    const raw = libraryPath ? (await file(VOICE_DESIGN_LIBRARY_PATH)).bytes.toString() : null
    const library = parseVoiceDesignLibrary(raw ?? { schemaVersion: 1, voices: [] })
    const presets: Record<string, string> = {}
    const designFiles: Record<string, string> = { [VOICE_DESIGN_LIBRARY_PATH]: raw ?? encode(library) }
    for (const voice of library.voices) {
      if (!voice.design)
        continue
      for (const implementation of Object.values(voice.implementations)) {
        for (const preset of Object.values(implementation.localePresets ?? {})) {
          const bytes = (await file(preset.presetPath)).bytes
          presets[preset.presetPath] = digest(bytes)
          designFiles[preset.presetPath] = bytes.toString()
        }
      }
    }
    if (library.voices.some(voice => voice.design))
      await validateDesignFiles(designFiles, designFiles)
    const characterSources = Object.fromEntries(Object.entries(project.files).filter(([path]) => path.startsWith('adv/characters/') || path === 'adv/settings/game.json'))
    const revision = await audioFingerprint({ library, audioRevision: audio.revision, characterSources, presets })
    return { project, authoring, audio, library, raw, revision }
  }
  async function verifyReference(definition: VoiceDesignDraft['locales'][string]['providers'][string], characterId: string) {
    if (definition.source !== 'cloned')
      return {}
    const current = await inputs()
    const asset = current.audio.catalog.assets.find(asset => asset.id === definition.reference?.assetId)
    if (!asset || asset.type !== 'audio' || asset.kind !== 'reference' || asset.sha256 !== definition.reference?.sha256 || (asset.characterId !== undefined && asset.characterId !== characterId))
      fail('VOICE_DESIGN_REFERENCE_INVALID')
    const media = await file(audioProjectMediaPath(current.audio.catalog, asset), MAX_MEDIA)
    if (digest(media.bytes) !== asset.sha256 || (asset.bytes !== undefined && media.bytes.length !== asset.bytes))
      fail('VOICE_DESIGN_REFERENCE_CHANGED')
    const consent = await file(definition.rights!.consentRecord, 64 * 1024).catch(() => fail('VOICE_DESIGN_CONSENT_REQUIRED'))
    return { referenceHash: digest(media.bytes), consentHash: digest(consent.bytes) }
  }
  async function providerInfos(): Promise<VoiceDesignProviderInfo[]> {
    const configuredVoice = await configured()
    const result: VoiceDesignProviderInfo[] = []
    for (const item of configuredVoice.providers) {
      if (!('synthesize' in item) || !item.buildDesignPreset || !item.capabilities.designSources?.length)
        continue
      const sources = item.capabilities.designSources
      const presets = []
      for (const [id, coordinate] of Object.entries(configuredVoice.voice.presets)) {
        if ((configuredVoice.voice.presetProviders?.[id] ?? configuredVoice.voice.defaultProvider ?? configuredVoice.providers[0]?.id) !== item.id)
          continue
        const template = JSON.parse((await file(coordinate)).bytes.toString()) as JsonObject
        const supported: VoiceDesignProviderInfo['sources'] = []
        for (const source of sources) {
          try {
            await item.buildDesignPreset({ template, characterId: 'narrator', text: '试听', locale: 'zh-CN', intent: {}, definition: { preset: id, source, ...(source === 'system' ? { providerVoiceId: (await item.listVoices?.())?.[0]?.id } : source === 'designed' ? { description: '平静清晰的声音' } : { reference: { assetId: 'reference/inspection', sha256: 'a'.repeat(64), mode: 'embedding-only' }, rights: { license: 'inspection', subject: 'inspection', consentRecord: 'authoring/rights/inspection.json' } }) } })
            supported.push(source)
          }
          catch { /* Unsupported template/source combinations are unavailable. */ }
        }
        if (typeof template.model === 'string' && supported.length)
          presets.push({ id, model: template.model, sources: supported })
      }
      result.push({ id: item.id, backend: item.capabilities.backend, sources, builtInVoices: await item.listVoices?.() ?? [], presets })
    }
    return result
  }
  const mediaPrefix = options.mediaPrefix ?? 'audio/voice-design/previews'
  function preview(entry: SavedPreview): VoiceDesignPreview {
    const { path: _path, ...candidate } = entry.candidate ?? {} as AdvVoiceCandidate
    return { ...entry.preview, ...(entry.candidate ? { candidate, mediaUrl: `${mediaPrefix}/${encodeURIComponent(entry.preview.id)}/media` } : {}) }
  }
  async function read(): Promise<VoiceDesignSnapshot> {
    const current = await inputs()
    const providers = await providerInfos().catch((error) => {
      if (error instanceof Error && error.message.includes('Configure authoring.voice'))
        return []
      throw error
    })
    return { configured: Boolean(providers.length), revision: current.revision, library: current.library, providers, speakers: [{ id: 'narrator', name: '旁白', ...(current.audio.narratorProfile ? { profile: current.audio.narratorProfile } : {}) }, ...current.project.result.project.characters.map(character => ({ id: character.id, name: character.name, ...(character.voiceProfile ? { profile: character.voiceProfile } : {}) }))], referenceAssets: current.audio.catalog.assets.filter(asset => asset.type === 'audio' && asset.kind === 'reference' && asset.sha256).map(asset => ({ id: asset.id, title: asset.title ?? asset.id, sha256: asset.sha256!, ...(asset.characterId ? { characterId: asset.characterId } : {}) })), previews: Object.values((await state()).previews).map(preview) }
  }
  async function expected(revision: string) {
    const current = await inputs()
    if (!HASH.test(revision) || current.revision !== revision)
      fail('VOICE_DESIGN_CONFLICT')
    return current
  }
  async function transaction(changes: VoiceDesignFileChange[]) {
    await applyEditorFileChanges(root, changes)
  }
  async function inspectReview(review: SavedReview) {
    const current = await inputs()
    const voice = voiceDesignVersion(current.library, review.review.voiceId)
    if (voice.version !== review.voiceVersion || (await file(review.presetPath)).bytes.length > 1024 * 1024 || digest((await file(review.presetPath)).bytes) !== review.review.presetSha256)
      fail('VOICE_DESIGN_REVIEW_STALE')
    const definition = voice.design.locales[review.review.locale]?.providers[review.review.providerId]
    if (!definition)
      fail('VOICE_DESIGN_REVIEW_STALE')
    const reference = await verifyReference(definition, voice.characterId)
    if (reference.referenceHash !== review.referenceHash || reference.consentHash !== review.consentHash)
      fail('VOICE_DESIGN_REVIEW_STALE')
    const inspected = await (await provider(review.review.providerId)).inspectPreset({ root, configPath: (await file(review.presetPath)).path, preset: `design-${voice.id}`, character: voice.characterId, text: review.review.text, ...(definition.reference?.mode ? { referenceMode: definition.reference.mode } : {}) })
    const generation = inspected.characters.find(character => character.id === voice.characterId)?.generation
    if (!generation || await audioFingerprint(generation) !== review.generationHash)
      fail('VOICE_DESIGN_REVIEW_STALE')
    return { current, voice, definition }
  }
  async function candidateMedia(candidate: AdvVoiceCandidate) {
    const bytes = (await file(candidate.path, MAX_MEDIA)).bytes
    if (!HASH.test(candidate.sha256) || !Number.isSafeInteger(candidate.bytes) || bytes.length !== candidate.bytes || digest(bytes) !== candidate.sha256 || !Number.isFinite(candidate.durationSeconds) || candidate.durationSeconds <= 0 || !Number.isSafeInteger(candidate.sampleRate) || candidate.sampleRate <= 0)
      fail('VOICE_DESIGN_MEDIA_CHANGED')
    return bytes
  }
  async function execute(id: string) {
    const controller = new AbortController()
    controllers.set(id, controller)
    let dispatched = false
    try {
      const saved = (await state()).previews[id]!
      const review = (await state()).reviews[saved.reviewId]!
      await inspectReview(review)
      if ((await inputs()).revision !== review.review.expectedRevision)
        fail('VOICE_DESIGN_REVIEW_STALE')
      await options.verifyProvider?.(review.review.providerId)
      const selected = await provider(review.review.providerId)
      if (!options.verifyProvider && selected.doctor) {
        const diagnosis = await selected.doctor({ root, signal: controller.signal })
        if (!diagnosis.supported || (selected.capabilities.backend === 'local' && !diagnosis.ready) || diagnosis.checks.some(check => check.status === 'fail'))
          fail('VOICE_DESIGN_PROVIDER_NOT_READY')
      }
      else if (!options.verifyProvider && selected.capabilities.backend === 'local') {
        fail('VOICE_DESIGN_PROVIDER_DIAGNOSIS_REQUIRED')
      }
      const operation = async () => {
        await access()
        // A preview can wait behind another paid request. Revalidate its
        // reviewed native inputs and authorization after acquiring the permit.
        const verified = await inspectReview(review)
        if (verified.current.revision !== review.review.expectedRevision)
          fail('VOICE_DESIGN_REVIEW_STALE')
        const configPath = (await file(review.presetPath)).path
        await mutateState((document) => {
          document.previews[id]!.preview.status = 'running'
        })
        controller.signal.throwIfAborted()
        dispatched = true
        return await selected.synthesize({ root, configPath, preset: `design-${review.review.voiceId}`, character: review.review.characterId, text: review.review.text, assetManifestPath: resolve(root, 'adv/assets.json'), ...(review.review.source === 'cloned' ? { referenceMode: verified.definition.reference?.mode ?? 'embedding-only' } : {}), signal: controller.signal, voiceId: review.review.voiceId, voiceVersion: review.voiceVersion })
      }
      const result = options.withProviderPermit ? await options.withProviderPermit(selected.id, controller.signal, operation) : await withVoiceProviderPermit(selected.id, selected.capabilities.backend === 'local' ? 1 : 3, controller.signal, operation)
      const candidate = result.candidates[0]
      if (result.provider !== selected.id || result.candidates.length !== 1 || !candidate || candidate.characterId !== review.review.characterId || candidate.text !== review.review.text || candidate.model !== review.review.model || candidate.providerVoiceId !== review.review.providerVoiceId || candidate.provider !== selected.id || candidate.mimeType !== review.mimeType || candidate.revision !== review.modelRevision)
        fail('VOICE_DESIGN_PROVENANCE_CHANGED')
      await candidateMedia(candidate)
      await mutateState((document) => {
        const current = document.previews[id]!
        current.candidate = candidate
        current.preview.status = controller.signal.aborted ? 'unknown' : 'ready'
      })
    }
    catch (error) {
      await mutateState((document) => {
        const entry = document.previews[id]!
        entry.preview.status = dispatched ? 'unknown' : controller.signal.aborted ? 'cancelled' : 'failed'
        entry.preview.error = dispatched ? 'VOICE_DESIGN_OUTCOME_UNKNOWN' : error instanceof Error && /^VOICE_DESIGN_[A-Z_]+$/u.test(error.message) ? error.message : 'VOICE_DESIGN_EXECUTION_FAILED'
      })
    }
    finally {
      controllers.delete(id)
      active.delete(id)
    }
  }
  const host = {
    read,
    async saveVersion(input: { expectedRevision: string, draft: VoiceDesignDraft }): Promise<VoiceDesignMutation> {
      if (!fields(input, ['expectedRevision', 'draft']))
        fail('VOICE_DESIGN_INPUT_INVALID')
      const draft = parseVoiceDesignDraft(input.draft)
      const changes = await withProjectWriteLock(root, async () => {
        const current = await expected(input.expectedRevision)
        if (draft.characterId !== 'narrator' && !current.project.result.project.characters.some(character => character.id === draft.characterId))
          fail('VOICE_DESIGN_SPEAKER_INVALID')
        const implementations: AdvVoiceProfile['implementations'] = {}
        const edits: VoiceDesignFileChange[] = []
        const configuredVoice = await configured()
        for (const [locale, binding] of Object.entries(draft.locales)) {
          for (const [providerId, definition] of Object.entries(binding.providers)) {
            const selected = await provider(providerId)
            if (!selected.capabilities.designSources?.includes(definition.source))
              fail('VOICE_DESIGN_SOURCE_UNSUPPORTED')
            if (definition.source === 'system' && !(await selected.listVoices?.())?.some(voice => voice.id === definition.providerVoiceId))
              fail('VOICE_DESIGN_BUILTIN_UNSUPPORTED')
            const coordinate = configuredVoice.voice.presets[definition.preset]
            const owner = configuredVoice.voice.presetProviders?.[definition.preset] ?? configuredVoice.voice.defaultProvider ?? configuredVoice.providers[0]?.id
            if (!coordinate || owner !== providerId)
              fail('VOICE_DESIGN_TEMPLATE_UNCONFIGURED')
            await verifyReference(definition, draft.characterId)
            const template = JSON.parse((await file(coordinate)).bytes.toString()) as JsonObject
            const preset = await selected.buildDesignPreset!({ template, characterId: draft.characterId, text: '这是音色试听。', locale, intent: draft.intent, definition })
            // Even a faulty adapter cannot replace the trusted model's identity or weights.
            for (const field of ['model', 'revision', 'weightSha256']) {
              if (canonicalAudioJson(preset[field] ?? null) !== canonicalAudioJson(template[field] ?? null))
                fail('VOICE_DESIGN_MODEL_IMMUTABLE')
            }
            const path = `${VOICE_DESIGN_PRESET_ROOT}/${draft.id}/${draft.version}/${locale}/${providerId}.json`
            const content = encode(preset)
            const target = await projectWriteTarget(root, path)
            if (await optional(target) !== null)
              fail('VOICE_DESIGN_VERSION_IMMUTABLE')
            edits.push({ path, expected: null, content })
            const name = `design-${draft.id}-${locale}`
            const implementation = implementations[providerId] ?? { preset: name, character: draft.characterId, presetPath: path, presetSha256: digest(content), ...(definition.reference?.mode ? { referenceMode: definition.reference.mode } : {}), localePresets: {} }
            implementation.localePresets![locale] = { preset: name, presetPath: path, presetSha256: digest(content) }
            implementations[providerId] = implementation
          }
        }
        const library = addVoiceDesignVersion(current.library, draft, implementations)
        edits.push({ path: VOICE_DESIGN_LIBRARY_PATH, expected: current.raw, content: encode(library) })
        await transaction(edits)
        return edits
      })
      return { snapshot: await read(), changes }
    },
    async planPreview(input: VoiceDesignPreviewInput): Promise<VoiceDesignPreviewReview> {
      if (!fields(input, ['voiceId', 'locale', 'providerId', 'text', 'expectedRevision', 'budget']) || !fields(input.budget, ['maxCharacters', 'allowUnknownCost']) || typeof input.text !== 'string' || !input.text.trim() || !Number.isSafeInteger(input.budget.maxCharacters) || input.budget.maxCharacters <= 0 || typeof input.budget.allowUnknownCost !== 'boolean')
        fail('VOICE_DESIGN_INPUT_INVALID')
      if (!input.budget.allowUnknownCost || Array.from(input.text).length > input.budget.maxCharacters)
        fail('VOICE_DESIGN_BUDGET_REVIEW_REQUIRED')
      const current = await expected(input.expectedRevision)
      const voice = voiceDesignVersion(current.library, input.voiceId)
      const locale = normalizeAudioLocale(input.locale)
      const definition = voice.design.locales[locale]?.providers[input.providerId]
      const implementation = voice.implementations[input.providerId]?.localePresets?.[locale]
      if (!definition || !implementation)
        fail('VOICE_DESIGN_BINDING_INVALID')
      const selected = await provider(input.providerId)
      const inspected = await selected.inspectPreset({ root, configPath: (await file(implementation.presetPath)).path, preset: `design-${voice.id}`, character: voice.characterId, text: input.text, ...(definition.reference?.mode ? { referenceMode: definition.reference.mode } : {}) })
      const actual = inspected.characters.find(character => character.id === voice.characterId)?.generation
      if (!actual || actual.source !== definition.source || inspected.characters.length !== 1)
        fail('VOICE_DESIGN_INSPECTION_REQUIRED')
      if (Array.from(input.text).length > Math.max(...selected.capabilities.models.map(model => model.maxTextCharacters ?? 4096)))
        fail('VOICE_DESIGN_TEXT_LIMIT')
      const reference = await verifyReference(definition, voice.characterId)
      const presetSha256 = digest((await file(implementation.presetPath)).bytes)
      if (presetSha256 !== implementation.presetSha256 || (inspected.presetSha256 && presetSha256 !== inspected.presetSha256))
        fail('VOICE_DESIGN_REVIEW_STALE')
      const base = { ...input, locale, id: randomUUID(), characterCount: Array.from(input.text).length, characterId: voice.characterId, model: actual.model, providerVoiceId: actual.providerVoiceId, source: definition.source, presetSha256, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }
      const review: VoiceDesignPreviewReview = { ...base, reviewHash: await audioFingerprint(base) }
      const generationHash = await audioFingerprint(actual)
      const executionKey = await audioFingerprint({ voiceId: voice.id, version: voice.version, locale, providerId: input.providerId, text: input.text, presetSha256, generationHash, rights: definition.rights ?? null, ...reference })
      await mutateState((document) => {
        document.reviews[review.id] = { review, executionKey, generationHash, presetPath: implementation.presetPath, voiceVersion: voice.version, mimeType: actual.mimeType, ...(actual.revision ? { modelRevision: actual.revision } : {}), ...reference }
      })
      return review
    },
    async executePreview(input: { reviewId: string, reviewHash: string }) {
      await access()
      if (!fields(input, ['reviewId', 'reviewHash']))
        fail('VOICE_DESIGN_INPUT_INVALID')
      const result = await mutateState((document) => {
        const savedReview = document.reviews[input.reviewId]
        const existing = Object.values(document.previews).find(entry => entry.reviewId === input.reviewId || (document.reviews[entry.reviewId]?.executionKey === savedReview?.executionKey && !['cancelled', 'failed'].includes(entry.preview.status)))
        const review = savedReview?.review
        if (!review || review.reviewHash !== input.reviewHash)
          fail('VOICE_DESIGN_REVIEW_REQUIRED')
        if (existing)
          return { created: false, entry: existing }
        if (Date.parse(review.expiresAt) < Date.now())
          fail('VOICE_DESIGN_REVIEW_EXPIRED')
        const entry: SavedPreview = { reviewId: input.reviewId, preview: { id: randomUUID(), voiceId: review.voiceId, locale: review.locale, providerId: review.providerId, status: 'queued' } }
        document.previews[entry.preview.id] = entry
        return { created: true, entry }
      })
      if (result.created) {
        const operation = execute(result.entry.preview.id)
        active.set(result.entry.preview.id, operation)
      }
      return preview(result.entry)
    },
    async readPreview(id: string) {
      await access()
      const entry = (await state()).previews[id]
      if (!entry)
        fail('VOICE_DESIGN_PREVIEW_NOT_FOUND')
      return preview(entry)
    },
    async cancelPreview(id: string) {
      await access()
      controllers.get(id)?.abort()
      return await mutateState((document) => {
        const entry = document.previews[id]
        if (!entry)
          fail('VOICE_DESIGN_PREVIEW_NOT_FOUND')
        if (entry.preview.status === 'queued')
          entry.preview.status = 'cancelled'
        else if (entry.preview.status === 'running')
          entry.preview.status = 'unknown'
        return preview(entry)
      })
    },
    async readPreviewAudio(id: string) {
      await access()
      const entry = (await state()).previews[id]
      if (!entry?.candidate || !['ready', 'registered'].includes(entry.preview.status))
        fail('VOICE_DESIGN_MEDIA_UNAVAILABLE')
      return { bytes: await candidateMedia(entry.candidate), mimeType: entry.candidate.mimeType, sha256: entry.candidate.sha256 }
    },
    async registerSample(input: { previewId: string, expectedRevision: string }): Promise<VoiceDesignMutation> {
      if (!fields(input, ['previewId', 'expectedRevision']))
        fail('VOICE_DESIGN_INPUT_INVALID')
      const saved = (await state()).previews[input.previewId]
      if (!saved?.candidate || !['ready', 'registered'].includes(saved.preview.status))
        fail('VOICE_DESIGN_READY_SAMPLE_REQUIRED')
      const review = (await state()).reviews[saved.reviewId]!
      const result = await withProjectWriteLock(root, async () => {
        const recovered = (await state()).previews[input.previewId]!.registration
        if (recovered) {
          const current = await inputs()
          const voice = voiceDesignVersion(current.library, review.review.voiceId)
          const sample = voice.design.samples.find(sample => sample.assetId === recovered.asset.id)
          const asset = current.audio.catalog.assets.find(asset => asset.id === recovered.asset.id)
          if (sample || asset) {
            if (!sample || !asset || canonicalAudioJson(sample) !== canonicalAudioJson(recovered.sample) || (['type', 'kind', 'path', 'sha256', 'bytes', 'mimeType', 'characterId'] as const).some(key => asset[key] !== recovered.asset[key]))
              fail('VOICE_DESIGN_REGISTRATION_CONFLICT')
            await verifySample(current, voice, sample)
            return recovered
          }
        }
        const current = await expected(input.expectedRevision)
        const { voice, definition } = await inspectReview(review)
        const bytes = await candidateMedia(saved.candidate!)
        const id = recovered?.asset.id ?? createAudioId('audio')
        const extension = ({ 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/flac': 'flac', 'audio/webm': 'webm' } as Record<string, string>)[saved.candidate!.mimeType]
        if (!extension)
          fail('VOICE_DESIGN_FORMAT_UNSUPPORTED')
        const asset = recovered?.asset ?? { id, type: 'audio' as const, kind: 'voice', path: `voice/samples/${id}.${extension}`, sha256: saved.candidate!.sha256, bytes: bytes.length, mimeType: saved.candidate!.mimeType, duration: saved.candidate!.durationSeconds, characterId: voice.characterId, state: 'candidate', title: voice.label, source: { type: 'generated', model: saved.candidate!.model, createdAt: new Date().toISOString() }, ...(definition.rights ? { license: definition.rights.license } : {}) }
        const target = await projectWriteTarget(root, audioProjectMediaPath(current.audio.catalog, asset))
        const existingMedia = await stat(target).catch(error => error.code === 'ENOENT' ? undefined : Promise.reject(error))
        if (existingMedia && (!recovered || !existingMedia.isFile() || existingMedia.size !== bytes.length || digest(await readFile(target)) !== saved.candidate!.sha256))
          fail('VOICE_DESIGN_MEDIA_EXISTS')
        const sample: VoiceDesignSample = recovered?.sample ?? { assetId: id, sha256: saved.candidate!.sha256, bytes: bytes.length, locale: saved.preview.locale, providerId: saved.preview.providerId, providerVoiceId: review.review.providerVoiceId, model: review.review.model, source: review.review.source, text: review.review.text, presetSha256: review.review.presetSha256, createdAt: String(asset.source!.createdAt) }
        voiceDesignVersion(current.library, voice.id).design.samples.push(sample)
        const rootCatalog = JSON.parse(current.project.files['adv/assets.json']!)
        const changes: VoiceDesignFileChange[] = [{ path: VOICE_DESIGN_LIBRARY_PATH, expected: current.raw, content: encode(parseVoiceDesignLibrary(current.library)) }]
        if (rootCatalog.includes) {
          const path = 'adv/assets/audio.json'
          const fragment = JSON.parse(current.project.files[path] ?? '{"schemaVersion":2,"assets":[]}')
          fragment.assets.push(asset)
          changes.push({ path, expected: current.project.files[path] ?? null, content: encode(fragment) })
          if (!rootCatalog.includes.includes('assets/audio.json')) {
            rootCatalog.includes.push('assets/audio.json')
            changes.push({ path: 'adv/assets.json', expected: current.project.files['adv/assets.json']!, content: encode(rootCatalog) })
          }
        }
        else {
          rootCatalog.assets.push(asset)
          changes.push({ path: 'adv/assets.json', expected: current.project.files['adv/assets.json']!, content: encode(rootCatalog) })
        }
        // Reserve the identity and exact author-side CAS patches before the
        // project transaction. A private receipt write failure after commit
        // must recover this sample instead of adding a second asset.
        const registration = { asset, sample, changes }
        await mutateState((document) => {
          document.previews[input.previewId]!.registration = registration
        })
        let copied = false
        try {
          if (!existingMedia) {
            await copyFile((await file(saved.candidate!.path, MAX_MEDIA)).path, target, 1)
            copied = true
          }
          if (digest(await readFile(target)) !== asset.sha256)
            fail('VOICE_DESIGN_MEDIA_CHANGED')
          await transaction(changes)
        }
        catch (error) {
          if (copied)
            await rm(target, { force: true })
          throw error
        }
        return registration
      })
      await mutateState((document) => {
        document.previews[input.previewId]!.preview.status = 'registered'
        document.previews[input.previewId]!.preview.registeredAssetId = result.asset.id
      })
      const { path: _path, ...candidate } = saved.candidate
      return { snapshot: await read(), changes: result.changes, media: { asset: result.asset, candidate, mediaUrl: `${mediaPrefix}/${encodeURIComponent(input.previewId)}/media` } }
    },
    async selectSample(input: Parameters<VoiceDesignPort['selectSample']>[0]): Promise<VoiceDesignMutation> {
      if (!fields(input, ['voiceId', 'locale', 'providerId', 'assetId', 'expectedRevision', 'replaceSelected']) || (input.replaceSelected !== undefined && typeof input.replaceSelected !== 'boolean'))
        fail('VOICE_DESIGN_INPUT_INVALID')
      const changes = await withProjectWriteLock(root, async () => {
        const current = await expected(input.expectedRevision)
        const voice = voiceDesignVersion(current.library, input.voiceId)
        const locale = normalizeAudioLocale(input.locale)
        const sample = voice.design.samples.find(sample => sample.assetId === input.assetId && sample.locale === locale && sample.providerId === input.providerId)
        if (!sample)
          fail('VOICE_DESIGN_SAMPLE_INVALID')
        await verifySample(current, voice, sample)
        const previous = voice.design.selectedSamples[locale]?.[input.providerId]
        if (previous && previous.assetId !== sample.assetId && !input.replaceSelected)
          fail('VOICE_DESIGN_REPLACE_REQUIRED')
        voice.design.selectedSamples[locale] = { ...voice.design.selectedSamples[locale], [input.providerId]: { assetId: sample.assetId, sha256: sample.sha256 } }
        voice.selectedSample = { assetId: sample.assetId, sha256: sample.sha256 }
        const changes = [{ path: VOICE_DESIGN_LIBRARY_PATH, expected: current.raw, content: encode(parseVoiceDesignLibrary(current.library)) }]
        await transaction(changes)
        return changes
      })
      return { snapshot: await read(), changes }
    },
    async applyProfile(input: Parameters<VoiceDesignPort['applyProfile']>[0]): Promise<VoiceDesignMutation> {
      if (!fields(input, ['voiceId', 'locale', 'providerId', 'expectedRevision', 'replaceBinding']) || (input.replaceBinding !== undefined && typeof input.replaceBinding !== 'boolean'))
        fail('VOICE_DESIGN_INPUT_INVALID')
      const result = await withProjectWriteLock(root, async () => {
        const current = await expected(input.expectedRevision)
        const voice = voiceDesignVersion(current.library, input.voiceId)
        const locale = normalizeAudioLocale(input.locale)
        const selected = voice.design.selectedSamples[locale]?.[input.providerId]
        const sample = voice.design.samples.find(sample => sample.assetId === selected?.assetId && sample.sha256 === selected.sha256)
        if (!sample)
          fail('VOICE_DESIGN_REVIEWED_SAMPLE_REQUIRED')
        await verifySample(current, voice, sample)
        const character = current.project.result.project.characters.find(character => character.id === voice.characterId)
        const profile = applyDesignedVoiceProfile(voice.characterId === 'narrator' ? current.audio.narratorProfile : character?.voiceProfile, voice, locale, input.providerId, sample, input.replaceBinding)
        const changes: VoiceDesignFileChange[] = []
        if (voice.characterId === 'narrator') {
          const path = 'adv/audio/voice-profiles.json'
          const previous = current.project.files[path] ?? null
          const document = current.audio.voiceProfiles!
          changes.push({ path, expected: previous, content: encode({ ...document, revision: document.revision + 1, narrator: profile }) })
        }
        else {
          const path = current.project.result.sourceMap.characters[voice.characterId]
          const gamePath = current.project.result.sourceMap.gameConfig ?? 'adv/settings/game.json'
          if (character && (!path || path === gamePath)) {
            const previous = current.project.files[gamePath]!
            const game = JSON.parse(previous)
            if (!Array.isArray(game.characters) || !game.characters.some((item: { id?: string }) => item.id === voice.characterId))
              fail('VOICE_DESIGN_CHARACTER_SOURCE_REQUIRED')
            game.characters = game.characters.map((item: { id?: string }) => item.id === voice.characterId ? { ...item, voiceProfile: profile } : item)
            changes.push({ path: gamePath, expected: previous, content: encode(game) })
          }
          else if (path?.endsWith('.character.md')) {
            const previous = current.project.files[path]!
            const patched = applyProjectPatches({ [path]: previous }, [{ kind: 'frontmatter-set', path, key: 'voiceProfile', value: profile as unknown as JsonObject }]).files[path]!
            changes.push({ path, expected: previous, content: patched })
          }
          else if (path?.startsWith('adv/characters/') && path.endsWith('.json')) {
            const previous = current.project.files[path]!
            changes.push({ path, expected: previous, content: encode({ ...JSON.parse(previous), voiceProfile: profile }) })
          }
          else { fail('VOICE_DESIGN_CHARACTER_SOURCE_UNSUPPORTED') }
        }
        await transaction(changes)
        return { changes, profile }
      })
      return { snapshot: await read(), ...result }
    },
    async close() {
      closed = true
      for (const controller of controllers.values())
        controller.abort()
      await Promise.allSettled(active.values())
    },
  }
  async function verifySample(current: Awaited<ReturnType<typeof inputs>>, voice: ReturnType<typeof voiceDesignVersion>, sample: VoiceDesignSample) {
    const asset = current.audio.catalog.assets.find(asset => asset.id === sample.assetId)
    const implementation = voice.implementations[sample.providerId]?.localePresets?.[sample.locale]
    if (!asset || asset.type !== 'audio' || asset.kind !== 'voice' || asset.characterId !== voice.characterId || asset.sha256 !== sample.sha256 || asset.state === 'rejected' || !implementation || implementation.presetSha256 !== sample.presetSha256)
      fail('VOICE_DESIGN_SAMPLE_INVALID')
    const media = await file(audioProjectMediaPath(current.audio.catalog, asset), MAX_MEDIA)
    if (digest(media.bytes) !== sample.sha256 || media.bytes.length !== sample.bytes)
      fail('VOICE_DESIGN_MEDIA_CHANGED')
    const definition = voice.design.locales[sample.locale]!.providers[sample.providerId]!
    await verifyReference(definition, voice.characterId)
    if (digest((await file(implementation.presetPath)).bytes) !== sample.presetSha256)
      fail('VOICE_DESIGN_REVIEW_STALE')
    const actual = await (await provider(sample.providerId)).inspectPreset({ root, configPath: (await file(implementation.presetPath)).path, preset: implementation.preset, character: voice.characterId, text: sample.text, ...(definition.reference?.mode ? { referenceMode: definition.reference.mode } : {}) })
    const generation = actual.characters.find(character => character.id === voice.characterId)?.generation
    if (!generation || generation.providerVoiceId !== sample.providerVoiceId || generation.model !== sample.model || generation.source !== sample.source)
      fail('VOICE_DESIGN_PROVENANCE_CHANGED')
  }
  return host
}
