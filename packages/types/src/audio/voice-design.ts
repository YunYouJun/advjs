import type { AdvAssetEntry } from '../config/assets'
import type { AdvVoiceCandidate, AdvVoiceLibrary, AdvVoiceProfile } from '../config/voice'
import type { CharacterVoiceProfile, VoiceRights } from './voice'

export type VoiceDesignSource = 'system' | 'designed' | 'cloned'

/** Model/revision/weight locations come exclusively from a trusted host preset. */
export interface VoiceDesignDefinition {
  preset: string
  source: VoiceDesignSource
  providerVoiceId?: string
  description?: string
  reference?: { assetId: string, sha256: string, text?: string, mode?: 'icl' | 'embedding-only' }
  rights?: VoiceRights
}

/** Each library ID has exactly one immutable design version; new versions use a new ID. */
export interface VoiceDesignDraft {
  id: string
  version: string
  characterId: string
  label: string
  intent: CharacterVoiceProfile['intent']
  locales: Record<string, { providers: Record<string, VoiceDesignDefinition> }>
  supersedes?: { id: string, version: string }
}

export interface VoiceDesignSample {
  assetId: string
  sha256: string
  bytes: number
  locale: string
  providerId: string
  providerVoiceId: string
  model: string
  source: VoiceDesignSource
  text: string
  presetSha256: string
  createdAt: string
}

export interface VoiceDesignRecord {
  schemaVersion: 1
  intent: CharacterVoiceProfile['intent']
  locales: VoiceDesignDraft['locales']
  supersedes?: VoiceDesignDraft['supersedes']
  samples: VoiceDesignSample[]
  selectedSamples: Record<string, Record<string, { assetId: string, sha256: string }>>
}

export interface VoiceDesignProviderInfo {
  id: string
  backend: 'local' | 'cloud'
  sources: VoiceDesignSource[]
  builtInVoices: Array<{ id: string, label: string }>
  presets: Array<{ id: string, model: string, sources: VoiceDesignSource[] }>
}

export interface VoiceDesignSnapshot {
  configured: boolean
  unavailableCode?: string
  revision: string
  library: AdvVoiceLibrary
  providers: VoiceDesignProviderInfo[]
  speakers: Array<{ id: string, name: string, profile?: CharacterVoiceProfile }>
  referenceAssets: Array<{ id: string, title: string, sha256: string, characterId?: string }>
  previews: VoiceDesignPreview[]
}

export interface VoiceDesignBudget {
  maxCharacters: number
  allowUnknownCost: boolean
}

export interface VoiceDesignPreviewInput {
  voiceId: string
  locale: string
  providerId: string
  text: string
  expectedRevision: string
  budget: VoiceDesignBudget
}

export interface VoiceDesignPreviewReview extends VoiceDesignPreviewInput {
  id: string
  reviewHash: string
  characterCount: number
  characterId: string
  model: string
  providerVoiceId: string
  source: VoiceDesignSource
  presetSha256: string
  expiresAt: string
}

export interface VoiceDesignPreview {
  id: string
  voiceId: string
  locale: string
  providerId: string
  status: 'queued' | 'running' | 'ready' | 'registered' | 'cancelled' | 'failed' | 'unknown'
  error?: string
  candidate?: Omit<AdvVoiceCandidate, 'path'>
  registeredAssetId?: string
  /** Authenticated relative route; never a local path or public signed URL. */
  mediaUrl?: string
}

/** Finite original-byte CAS edits returned for Studio's same-ID native import. */
export interface VoiceDesignFileChange {
  path: string
  expected: string | null
  content: string | null
}

export interface VoiceDesignMutation {
  snapshot: VoiceDesignSnapshot
  changes: VoiceDesignFileChange[]
  media?: { asset: AdvAssetEntry, candidate: Omit<AdvVoiceCandidate, 'path'>, mediaUrl: string }
  profile?: CharacterVoiceProfile
}

/** Editor and Studio use the same trusted execution and explicit authoring operations. */
export interface VoiceDesignPort {
  read: (signal?: AbortSignal) => Promise<VoiceDesignSnapshot>
  saveVersion: (input: { expectedRevision: string, draft: VoiceDesignDraft }, signal?: AbortSignal) => Promise<VoiceDesignMutation>
  planPreview: (input: VoiceDesignPreviewInput, signal?: AbortSignal) => Promise<VoiceDesignPreviewReview>
  executePreview: (input: { reviewId: string, reviewHash: string }, signal?: AbortSignal) => Promise<VoiceDesignPreview>
  readPreview: (id: string, signal?: AbortSignal) => Promise<VoiceDesignPreview>
  cancelPreview: (id: string, signal?: AbortSignal) => Promise<VoiceDesignPreview>
  readPreviewAudio: (id: string, signal?: AbortSignal) => Promise<Blob>
  registerSample: (input: { previewId: string, expectedRevision: string }, signal?: AbortSignal) => Promise<VoiceDesignMutation>
  selectSample: (input: { voiceId: string, locale: string, providerId: string, assetId: string, expectedRevision: string, replaceSelected?: boolean }, signal?: AbortSignal) => Promise<VoiceDesignMutation>
  applyProfile: (input: { voiceId: string, locale: string, providerId: string, expectedRevision: string, replaceBinding?: boolean }, signal?: AbortSignal) => Promise<VoiceDesignMutation>
}

export type DesignedVoiceProfile = AdvVoiceProfile & { design: VoiceDesignRecord }
