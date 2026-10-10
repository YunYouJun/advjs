import type { JsonObject } from '../runtime'

/** Available reference conditioning modes for an authoring voice provider. */
export type AdvVoiceReferenceMode = 'icl' | 'embedding-only'

/** Local authoring context; never serialized into a player configuration. */
export interface AdvVoiceContext {
  root: string
  signal?: AbortSignal
  onProgress?: (message: string) => void
}

/** Resolved project inputs passed to an optional synthesis provider. */
export interface AdvVoicePreviewRequest extends AdvVoiceContext {
  configPath: string
  assetManifestPath?: string
  preset: string
  character?: string
  text?: string
  seed: number
  referenceMode?: AdvVoiceReferenceMode
  offline?: boolean
}

/** A read-only diagnosis that does not prepare environments or download models. */
export interface AdvVoiceDoctorResult {
  provider: string
  supported: boolean
  ready: boolean
  environmentDirectory?: string
  modelCacheDirectory?: string
  checks: Array<{
    id: string
    status: 'pass' | 'warn' | 'fail'
    message: string
  }>
}

/** Result of an explicitly requested environment preparation. */
export interface AdvVoiceSetupResult {
  provider: string
  ready: boolean
  environmentDirectory?: string
}

/** Generated candidates and their reproducible, provider-specific provenance. */
export interface AdvVoicePreviewResult {
  provider: string
  preset: string
  manifestPath: string
  manifest: JsonObject
  /** Normalized candidates; registration and selection remain explicit. */
  candidates?: AdvVoiceCandidate[]
}

/** Provider-independent provenance for one unbound synthesis output. */
export interface AdvVoiceCandidate {
  id: string
  characterId: string
  text: string
  path: string
  sha256: string
  bytes: number
  mimeType: string
  durationSeconds: number
  sampleRate: number
  provider: string
  model?: string
  revision?: string
  inputFingerprint?: string
  voiceId?: string
  voiceVersion?: string
}

/** Modern synthesis always reports normalized local candidates. */
export interface AdvVoiceSynthesisResult extends AdvVoicePreviewResult {
  candidates: AdvVoiceCandidate[]
}

/** Advertised operations and model-specific constraints of an authoring adapter. */
export interface AdvVoiceCapabilities {
  backend: 'local' | 'cloud'
  synthesis: boolean
  voiceCreation: boolean
  offline: boolean
  models: Array<{
    id: string
    modes: string[]
    maxTextCharacters?: number
    formats: string[]
    streaming: boolean
  }>
}

/** Generic synthesis inputs; adapters own defaults and parameter validation. */
export interface AdvVoiceSynthesisRequest extends Omit<AdvVoicePreviewRequest, 'seed' | 'referenceMode'> {
  seed?: number
  referenceMode?: string
  defaultReferenceMode?: string
  voiceId?: string
  voiceVersion?: string
}

/** Read-only preset inspection, without downloading references or invoking synthesis. */
export interface AdvVoicePresetInspection {
  characters: Array<{ id: string, name: string, card?: string, text: string, referenceAssetId?: string }>
  seed?: number
  referenceMode?: string
  requiresReferenceAssets?: boolean
}

/** Voice creation is a separate optional operation, never a side effect of synthesis. */
export interface AdvVoiceCreateRequest extends AdvVoiceContext {
  id: string
  version: string
  characterId: string
  parameters: JsonObject
}

/** Modern adapter; cloud providers need neither a local directory nor setup. */
export interface AdvVoiceSynthesisProvider {
  id: string
  capabilities: AdvVoiceCapabilities
  inspectPreset: (request: AdvVoiceSynthesisRequest) => Promise<AdvVoicePresetInspection>
  synthesize: (request: AdvVoiceSynthesisRequest) => Promise<AdvVoiceSynthesisResult>
  doctor?: (context: AdvVoiceContext) => Promise<AdvVoiceDoctorResult>
  setup?: (context: AdvVoiceContext) => Promise<AdvVoiceSetupResult>
  createVoice?: (request: AdvVoiceCreateRequest) => Promise<JsonObject>
}

/** A stable project identity with separate implementations for each provider. */
export interface AdvVoiceProfile {
  id: string
  version: string
  characterId: string
  label: string
  implementations: Record<string, { preset: string, presetSha256?: string, character?: string, referenceMode?: string }>
  /** A reviewed sample selection, not a dialogue or voice-actor credit. */
  selectedSample?: { assetId: string, sha256: string }
}

/** Authoring-only identities and sample selections; audio stays in the native asset manifest. */
export interface AdvVoiceLibrary {
  schemaVersion: 1
  voices: AdvVoiceProfile[]
}

/** Native audio entries available for author review, without remote URLs or paths. */
export interface AdvVoiceLibrarySnapshot {
  configured: boolean
  revision?: string
  voices: AdvVoiceProfile[]
  samples: Array<{ assetId: string, characterId?: string, title: string, sha256?: string, bytes?: number, state?: string }>
}

/** Explicit, optimistic-concurrency sample selection. */
export interface AdvVoiceSelectInput {
  voiceId: string
  assetId: string
  expectedRevision: string
  replaceSelected?: boolean
}

/** Node-only authoring service implemented by an optional voice plugin. */
export interface AdvVoiceProvider {
  id: string
  doctor: (context: AdvVoiceContext) => Promise<AdvVoiceDoctorResult>
  setup: (context: AdvVoiceContext) => Promise<AdvVoiceSetupResult>
  preview: (request: AdvVoicePreviewRequest) => Promise<AdvVoicePreviewResult>
}

/** Project-owned preset locations and defaults; excluded from player exports. */
export interface AdvAuthoringVoiceConfig {
  /** Legacy single-provider configuration remains supported. */
  provider?: AdvVoiceProvider | AdvVoiceSynthesisProvider
  providers?: Array<AdvVoiceProvider | AdvVoiceSynthesisProvider>
  defaultProvider?: string
  presetProviders?: Record<string, string>
  presets: Record<string, string>
  defaultPreset: string
  defaultReferenceMode?: string
  assetManifest?: string
  library?: string
}
