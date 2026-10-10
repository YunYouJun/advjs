import type {
  AdvAuthoringVoiceConfig,
  AdvConfig,
  AdvVoiceContext,
  AdvVoiceCreateRequest,
  AdvVoiceDoctorResult,
  AdvVoicePreviewRequest,
  AdvVoicePreviewResult,
  AdvVoiceProvider,
  AdvVoiceReferenceMode,
  AdvVoiceSetupResult,
  AdvVoiceSynthesisProvider,
  AdvVoiceSynthesisRequest,
} from '@advjs/types'
import { createHash } from 'node:crypto'
import { readFile, realpath, stat } from 'node:fs/promises'
import process from 'node:process'
import { isAbsolute, relative, resolve, sep } from 'pathe'
import { loadAdvConfig } from '../config'
import { AdvCommandError } from './errors'
import { readVoiceAssetManifest, readVoiceLibrary } from './voice-library'

/** Common project context for provider-neutral authoring voice commands. */
export interface VoiceCommandOptions extends Omit<AdvVoiceContext, 'root'> {
  root?: string
  provider?: string
  /** Programmatic configuration seam; the CLI reads adv.config.ts instead. */
  config?: Partial<AdvConfig>
}

/** Options shared by candidate listing and synthesis. */
export interface VoicePreviewOptions extends VoiceCommandOptions {
  preset?: string
  referenceMode?: string
  voice?: string
  character?: string
  text?: string
  seed?: number
  offline?: boolean
  list?: boolean
}

/** Preset information that can be inspected without a synthesis environment. */
export interface VoiceListResult {
  provider: string
  preset: string
  configPath: string
  referenceMode?: string
  seed?: number
  characters: Array<{
    id: string
    name: string
    card?: string
    text: string
    referenceAssetId?: string
  }>
}

interface PresetCharacter {
  id: string
  name: string
  card?: string
  text: string
  reference?: {
    assetId: string
    sha256: string
    text?: string
  }
}

const SHA256_RE = /^[a-f0-9]{64}$/u
const REFERENCE_MODES = ['icl', 'embedding-only'] as const

function invalid(message: string): AdvCommandError {
  return new AdvCommandError('ADV_VALIDATION', message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function within(root: string, target: string): boolean {
  const path = relative(root, target)
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
}

function projectPath(root: string, path: unknown, label: string): string {
  if (typeof path !== 'string' || !path.trim() || isAbsolute(path) || /^[a-z]:[\\/]/iu.test(path))
    throw invalid(`${label} must be a project-relative path`)
  const target = resolve(root, path.replaceAll('\\', '/'))
  if (!within(root, target))
    throw invalid(`${label} escapes the project root: ${path}`)
  return target
}

async function projectFile(root: string, path: unknown, label: string): Promise<string> {
  const target = projectPath(root, path, label)
  let canonical: string
  try {
    canonical = await realpath(target)
    if (!(await stat(canonical)).isFile())
      throw invalid(`${label} must be a file: ${String(path)}`)
  }
  catch (error) {
    if (error instanceof AdvCommandError)
      throw error
    throw invalid(`${label} is missing or unreadable: ${String(path)}`)
  }
  if (!within(root, canonical))
    throw invalid(`${label} resolves outside the project root: ${String(path)}`)
  return canonical
}

async function readObject(path: string, label: string): Promise<Record<string, unknown>> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (!isRecord(value))
      throw invalid(`${label} must contain a JSON object`)
    return value
  }
  catch (error) {
    if (error instanceof AdvCommandError)
      throw error
    throw invalid(`${label} contains invalid JSON`)
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw invalid(`${label} must be a nonempty string`)
  return value
}

function targetText(value: unknown, label: string): string {
  const result = text(value, label)
  if (Array.from(result).length > 500)
    throw invalid(`${label} must contain at most 500 characters`)
  return result
}

function parseCharacters(preset: Record<string, unknown>): PresetCharacter[] {
  if (!Array.isArray(preset.characters) || preset.characters.length === 0)
    throw invalid('Voice preset must contain at least one character')
  const ids = new Set<string>()
  return preset.characters.map((value: unknown, index: number) => {
    if (!isRecord(value))
      throw invalid(`Voice preset character ${index + 1} must be an object`)
    const id = text(value.id, 'Voice character id')
    if (ids.has(id))
      throw invalid(`Duplicate voice character id: ${id}`)
    ids.add(id)
    let reference: PresetCharacter['reference']
    if (value.reference !== undefined) {
      if (!isRecord(value.reference))
        throw invalid(`Voice reference for ${id} must be an object`)
      const sha256 = text(value.reference.sha256, `Reference SHA-256 for ${id}`)
      if (!SHA256_RE.test(sha256))
        throw invalid(`Reference SHA-256 for ${id} must contain 64 lowercase hexadecimal characters`)
      reference = {
        assetId: text(value.reference.assetId, `Reference asset id for ${id}`),
        sha256,
        ...(typeof value.reference.text === 'string' ? { text: value.reference.text } : {}),
      }
    }
    return {
      id,
      name: value.name === undefined ? id : text(value.name, `Voice character name for ${id}`),
      ...(value.card === undefined ? {} : { card: text(value.card, `Character card for ${id}`) }),
      text: targetText(value.text, `Target text for ${id}`),
      ...(reference ? { reference } : {}),
    }
  })
}

async function context(options: VoiceCommandOptions & { preset?: string }): Promise<{ context: AdvVoiceContext, voice: AdvAuthoringVoiceConfig, provider: AdvVoiceProvider | AdvVoiceSynthesisProvider, providers: Array<AdvVoiceProvider | AdvVoiceSynthesisProvider> }> {
  const root = await realpath(resolve(options.root ?? process.cwd()))
  const { config } = await loadAdvConfig({ userRoot: root, advConfig: options.config })
  const voice = config.authoring?.voice
  if (!voice || !isRecord(voice))
    throw invalid('Configure authoring.voice in adv.config.ts before using adv voice')
  if (voice.providers !== undefined && !Array.isArray(voice.providers))
    throw invalid('authoring.voice.providers must be an array')
  const providers = [...(voice.providers ?? []), ...(voice.provider ? [voice.provider] : [])]
  const ids = new Set<string>()
  for (const provider of providers) {
    if (!isRecord(provider) || typeof provider.id !== 'string' || !provider.id.trim()
      || (!('synthesize' in provider && typeof provider.synthesize === 'function' && typeof provider.inspectPreset === 'function' && isRecord(provider.capabilities))
        && !(typeof provider.doctor === 'function' && typeof provider.setup === 'function' && typeof provider.preview === 'function'))) {
      throw invalid('authoring.voice.provider must be an installed provider object with synthesis or legacy preview methods')
    }
    if (ids.has(provider.id))
      throw invalid(`Duplicate voice provider: ${provider.id}`)
    ids.add(provider.id)
  }
  for (const [preset, provider] of Object.entries(voice.presetProviders ?? {})) {
    if (!Object.hasOwn(voice.presets ?? {}, preset) || !ids.has(provider))
      throw invalid(`Invalid voice preset provider mapping: ${preset}`)
  }
  if (voice.defaultProvider !== undefined && !ids.has(voice.defaultProvider))
    throw invalid(`Unknown default voice provider: ${voice.defaultProvider}`)
  const providerId = options.provider ?? voice.presetProviders?.[options.preset ?? voice.defaultPreset] ?? voice.defaultProvider ?? voice.provider?.id ?? providers[0]?.id
  const provider = providers.find(item => item.id === providerId)
  if (!provider)
    throw invalid(`Unknown voice provider: ${providerId ?? '(none)'}`)
  if (!isRecord(voice.presets) || Object.keys(voice.presets).length === 0)
    throw invalid('authoring.voice.presets must contain project-relative JSON preset paths')
  text(voice.defaultPreset, 'authoring.voice.defaultPreset')
  if (!Object.hasOwn(voice.presets, voice.defaultPreset))
    throw invalid(`Default voice preset is not configured: ${voice.defaultPreset}`)
  for (const [id, path] of Object.entries(voice.presets))
    projectPath(root, path, `Voice preset ${id}`)
  if (voice.assetManifest !== undefined)
    projectPath(root, voice.assetManifest, 'Voice asset manifest')
  return { context: { root, signal: options.signal, onProgress: options.onProgress }, voice, provider, providers }
}

async function validateReferences(root: string, path: string, characters: PresetCharacter[]): Promise<void> {
  const manifest = await readVoiceAssetManifest(root, relative(root, path))
  for (const character of characters) {
    const reference = character.reference!
    const asset = manifest.assets.find(asset => asset.id === reference.assetId)
    if (!asset || asset.type !== 'audio' || asset.kind !== 'reference' || asset.characterId !== character.id)
      throw invalid(`Reference audio asset is missing or belongs to a different character: ${reference.assetId}`)
    if (asset.sha256 !== reference.sha256)
      throw invalid(`Reference SHA-256 does not match the asset manifest: ${reference.assetId}`)
    const profile = manifest.profiles[manifest.download?.profile ?? manifest.defaultProfile]
    const cachePath = asset.cachePath ?? (profile?.provider === 'project' && asset.path
      ? relative(root, resolve(projectPath(root, profile.root ?? '.', 'Reference cache root'), asset.path))
      : undefined)
    const file = await projectFile(root, cachePath, `Reference audio ${reference.assetId}; prepare the project asset cache if missing`)
    const content = await readFile(file)
    if (createHash('sha256').update(content).digest('hex') !== reference.sha256)
      throw invalid(`Reference audio checksum mismatch: ${reference.assetId}`)
  }
}

/** Diagnose an optional voice provider without installing or downloading anything. */
export async function runVoiceDoctor(options: VoiceCommandOptions = {}): Promise<AdvVoiceDoctorResult> {
  const loaded = await context(options)
  if (!loaded.provider.doctor)
    return { provider: loaded.provider.id, supported: true, ready: false, checks: [{ id: 'diagnostics', status: 'warn', message: 'This provider does not expose readiness diagnostics' }] }
  return await loaded.provider.doctor(loaded.context)
}

/** Explicitly prepare the configured provider's isolated authoring environment. */
export async function runVoiceSetup(options: VoiceCommandOptions = {}): Promise<AdvVoiceSetupResult> {
  const loaded = await context(options)
  if (!loaded.provider.setup)
    throw new AdvCommandError('ADV_USAGE', `Provider ${loaded.provider.id} does not support local setup`)
  return await loaded.provider.setup(loaded.context)
}

/** List project inputs or generate unbound voice candidates through the configured provider. */
export async function runVoicePreview(options: VoicePreviewOptions = {}): Promise<VoiceListResult | AdvVoicePreviewResult> {
  const loaded = await context(options)
  const { root } = loaded.context
  let preset = options.preset ?? loaded.voice.defaultPreset
  let voiceId: string | undefined
  let voiceVersion: string | undefined
  let presetSha256: string | undefined
  if (options.voice) {
    const library = await readVoiceLibrary(root, loaded.voice.library)
    const profile = library.library.voices.find(item => item.id === options.voice)
    if (!profile)
      throw invalid(`Unknown voice identity: ${options.voice}`)
    const implementation = profile.implementations[loaded.provider.id]
    if (!implementation)
      throw invalid(`Voice ${profile.id} has no implementation for ${loaded.provider.id}`)
    if (options.preset && options.preset !== implementation.preset)
      throw invalid('An explicit preset must match the selected voice implementation')
    if (options.character && options.character !== (implementation.character ?? profile.characterId))
      throw invalid('The requested character does not match the voice identity')
    preset = implementation.preset
    options = { ...options, character: implementation.character ?? profile.characterId, referenceMode: options.referenceMode ?? implementation.referenceMode }
    voiceId = profile.id
    voiceVersion = profile.version
    presetSha256 = implementation.presetSha256
  }
  if (!Object.hasOwn(loaded.voice.presets, preset))
    throw new AdvCommandError('ADV_USAGE', `Unknown voice preset: ${preset}`)
  const configPath = await projectFile(root, loaded.voice.presets[preset], `Voice preset ${preset}`)
  if (presetSha256 && createHash('sha256').update(await readFile(configPath)).digest('hex') !== presetSha256)
    throw invalid('VOICE_CONFLICT: The selected voice preset changed; review a new voice version')
  if ('synthesize' in loaded.provider) {
    const provider = loaded.provider
    const presetSource = await readFile(configPath, 'utf8')
    const request: AdvVoiceSynthesisRequest = {
      ...loaded.context,
      configPath,
      preset,
      character: options.character,
      text: options.text,
      seed: options.seed,
      referenceMode: options.referenceMode,
      defaultReferenceMode: loaded.voice.defaultReferenceMode,
      offline: options.offline,
      voiceId,
      voiceVersion,
    }
    if (options.text !== undefined && !options.character)
      throw new AdvCommandError('ADV_USAGE', '--text requires --character')
    if (options.offline && !provider.capabilities.offline)
      throw new AdvCommandError('ADV_USAGE', `Provider ${provider.id} does not support offline synthesis`)
    loaded.context.signal?.throwIfAborted()
    const inspected = await provider.inspectPreset(request)
    if (!inspected.characters.length || new Set(inspected.characters.map(item => item.id)).size !== inspected.characters.length)
      throw invalid('The provider must inspect at least one uniquely identified character')
    for (const character of inspected.characters) {
      text(character.id, 'Voice character id')
      text(character.text, 'Voice target text')
      if (character.card)
        await projectFile(root, character.card, `Character card for ${character.id}`)
    }
    loaded.context.signal?.throwIfAborted()
    if (options.list)
      return { provider: provider.id, preset, configPath, seed: inspected.seed, referenceMode: inspected.referenceMode, characters: inspected.characters }
    if (!provider.capabilities.synthesis)
      throw new AdvCommandError('ADV_USAGE', `Provider ${provider.id} does not support synthesis`)
    if (inspected.requiresReferenceAssets)
      request.assetManifestPath = await projectFile(root, loaded.voice.assetManifest ?? 'adv/assets.json', 'Voice asset manifest')
    const result = await provider.synthesize(request)
    loaded.context.signal?.throwIfAborted()
    if (result.provider !== provider.id || result.preset !== preset || !Array.isArray(result.candidates)
      || result.candidates.length !== inspected.characters.length) {
      throw invalid('The synthesis result does not match the requested provider and preset')
    }
    if (await readFile(configPath, 'utf8') !== presetSource)
      throw invalid('VOICE_CONFLICT: The preset changed during synthesis')
    const fingerprint = createHash('sha256').update(JSON.stringify({
      provider: provider.id,
      preset: presetSource,
      characters: inspected.characters,
      seed: inspected.seed,
      referenceMode: inspected.referenceMode,
      voiceId,
      voiceVersion,
    })).digest('hex')
    const candidateIds = new Set<string>()
    const candidateCharacters = new Set<string>()
    for (const candidate of result.candidates) {
      const input = inspected.characters.find(item => item.id === candidate.characterId)
      if (!input || input.text !== candidate.text || candidate.provider !== provider.id
        || !candidate.id || candidateIds.has(candidate.id) || candidateCharacters.has(candidate.characterId)
        || !provider.capabilities.models.some(model => model.formats.includes(candidate.mimeType)) || !SHA256_RE.test(candidate.sha256)
        || !Number.isInteger(candidate.bytes) || candidate.bytes <= 0
        || !Number.isFinite(candidate.durationSeconds) || candidate.durationSeconds <= 0
        || !Number.isInteger(candidate.sampleRate) || candidate.sampleRate <= 0) {
        throw invalid('Invalid normalized voice candidate identity, text, or audio metadata')
      }
      candidateIds.add(candidate.id)
      candidateCharacters.add(candidate.characterId)
      const file = await projectFile(root, candidate.path, 'Voice candidate')
      const bytes = await readFile(file)
      if (bytes.length !== candidate.bytes || createHash('sha256').update(bytes).digest('hex') !== candidate.sha256)
        throw invalid('Voice candidate checksum or size differs from the synthesis result')
      candidate.inputFingerprint = fingerprint
      candidate.voiceId = voiceId
      candidate.voiceVersion = voiceVersion
    }
    return result
  }
  const source = await readObject(configPath, `Voice preset ${preset}`)
  const characters = parseCharacters(source)
  const selected = options.character === undefined ? characters : characters.filter(character => character.id === options.character)
  if (selected.length === 0)
    throw new AdvCommandError('ADV_USAGE', `Unknown voice character: ${options.character}`)
  const hasReference = selected.some(character => character.reference !== undefined)
  if (hasReference && selected.some(character => character.reference === undefined))
    throw invalid('A voice preview batch must use one generation mode; select a character with --character')
  if (options.referenceMode !== undefined && !REFERENCE_MODES.includes(options.referenceMode as AdvVoiceReferenceMode))
    throw new AdvCommandError('ADV_USAGE', '--reference-mode must be icl or embedding-only')
  if (options.referenceMode !== undefined && !hasReference)
    throw new AdvCommandError('ADV_USAGE', '--reference-mode requires a reference voice preset')
  const referenceMode = hasReference ? options.referenceMode ?? loaded.voice.defaultReferenceMode ?? 'embedding-only' : undefined
  const seed = options.seed ?? 42
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF)
    throw new AdvCommandError('ADV_USAGE', '--seed must be an unsigned 32-bit integer')
  if (options.text !== undefined && options.character === undefined)
    throw new AdvCommandError('ADV_USAGE', '--text requires --character')
  if (options.text !== undefined)
    targetText(options.text, '--text')
  for (const character of selected) {
    if (character.card !== undefined)
      await projectFile(root, character.card, `Character card for ${character.id}`)
    if (referenceMode === 'icl' && !character.reference?.text?.trim())
      throw invalid(`ICL requires a reference transcription for ${character.id}`)
  }
  const request: AdvVoicePreviewRequest = {
    ...loaded.context,
    configPath,
    preset,
    character: options.character,
    text: options.text,
    seed,
    referenceMode: referenceMode as AdvVoiceReferenceMode | undefined,
    offline: options.offline,
  }
  if (options.list) {
    return {
      provider: loaded.provider.id,
      preset,
      configPath,
      referenceMode,
      seed,
      characters: selected.map(character => ({
        id: character.id,
        name: character.name,
        ...(character.card === undefined ? {} : { card: character.card }),
        text: options.text ?? character.text,
        ...(character.reference ? { referenceAssetId: character.reference.assetId } : {}),
      })),
    }
  }
  if (hasReference) {
    request.assetManifestPath = await projectFile(root, loaded.voice.assetManifest ?? 'adv/assets.json', 'Voice asset manifest')
    await validateReferences(root, request.assetManifestPath, selected)
  }
  return await loaded.provider.preview(request)
}

/** Inspect installed providers without running diagnostics, setup, or synthesis. */
export async function runVoiceProviders(options: VoiceCommandOptions = {}) {
  const loaded = await context(options)
  return { providers: loaded.providers.map(provider => ({ id: provider.id, default: provider.id === loaded.provider.id, capabilities: 'capabilities' in provider ? provider.capabilities : null, legacy: !('synthesize' in provider), diagnostics: Boolean(provider.doctor), setup: Boolean(provider.setup), voiceCreation: 'createVoice' in provider && Boolean(provider.createVoice) })) }
}

/** Explicit voice creation is independent of synthesis and local environment preparation. */
export async function runVoiceCreate(options: VoiceCommandOptions & Omit<AdvVoiceCreateRequest, 'root'>) {
  const loaded = await context(options)
  if (!('createVoice' in loaded.provider) || !loaded.provider.createVoice || !loaded.provider.capabilities.voiceCreation)
    throw new AdvCommandError('ADV_USAGE', `Provider ${loaded.provider.id} does not support voice creation`)
  loaded.context.signal?.throwIfAborted()
  const result = await loaded.provider.createVoice({ ...loaded.context, id: options.id, version: options.version, characterId: options.characterId, parameters: options.parameters })
  loaded.context.signal?.throwIfAborted()
  return result
}
