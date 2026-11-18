import type { AdvAssetEntry, AdvAssetManifest } from '../config/assets'
import type { AdvVoiceCandidate, AdvVoiceSynthesisResult } from '../config/voice'
import type { JsonObject } from '../runtime/json'
import type { AudioPronunciationDictionary } from './pronunciation'
import type { VoiceAlignment } from './voice-alignment'
import type { AudioVoiceProfiles } from './voice-profiles'

export type VoiceTakeSource = 'system' | 'designed' | 'recorded' | 'cloned'

/** Auditable permission for a project to use a voice; never credentials. */
export interface VoiceRights {
  license: string
  subject: string
  consentRecord: string
}

/** Provider-neutral intent and explicit locale bindings, also used by narrator. */
export interface CharacterVoiceProfile {
  intent: {
    ageImpression?: string
    genderExpression?: string
    temperament?: string[]
    speakingStyle?: string
    pitch?: 'low' | 'medium' | 'high'
    pace?: 'slow' | 'medium' | 'fast'
  }
  locales?: Record<string, {
    providers: Record<string, {
      voiceId: string
      source: VoiceTakeSource
      model?: string
      rights?: VoiceRights
      /** Reviewed author library implementation; supplier voiceId remains separate. */
      projectVoiceId?: string
      projectVoiceVersion?: string
    }>
  }>
}

/** Immutable media and actual generation provenance for one dialogue take. */
export interface VoiceTake {
  id: string
  assetId: string
  sha256: string
  providerId: string
  /** Supplier voice ID, separate from the author's versioned voice identity. */
  voiceId: string
  model: string
  modelRevision?: string
  voiceProfileRevision: string
  inputFingerprint: string
  pronunciationRevision?: string
  spokenText: string
  createdAt: string
  source: VoiceTakeSource
  rights?: VoiceRights
  parameters?: JsonObject
  /** Project voice identity, when a reviewed provider implementation was used. */
  projectVoiceId?: string
  projectVoiceVersion?: string
  alignment?: VoiceAlignment
}

export interface VoiceLedgerLocale {
  selectedTake: string | null
  takes: VoiceTake[]
  /** Localized dialogue; the line's global text remains its source prose. */
  displayText?: string
  spokenText?: string
}

export interface VoiceLedgerLine {
  speakerId: string
  displayText: string
  spokenText?: string
  locales: Record<string, VoiceLedgerLocale>
}

/** The canonical authoring document at adv/audio/voice-ledger.json. */
export interface VoiceLedger {
  schemaVersion: 1
  lines: Record<string, VoiceLedgerLine>
}

export interface VoiceTakeResolution {
  take?: VoiceTake
  warnings: Array<{ code: 'VOICE_STALE', message: string }>
}

/** Snapshot shared by desktop Editor, Studio and CLI authoring adapters. */
export interface VoiceAuthoringSnapshot {
  revision: string
  ledger: VoiceLedger
  catalog: AdvAssetManifest
  pronunciation?: AudioPronunciationDictionary
  voiceProfiles?: AudioVoiceProfiles
  narratorProfile?: CharacterVoiceProfile
}

export interface VoiceTakeBindingInput {
  lineId: string
  locale: string
  speakerId: string
  displayText: string
  spokenText?: string
  candidate: AdvVoiceCandidate
  /** Immutable destination chosen by the host; relative to the asset profile root. */
  assetPath: string
  voiceProfileRevision: string
  /** Explicit actual voice if the provider has no built-in voice IDs (e.g. design). */
  providerVoiceId?: string
  source: VoiceTakeSource
  rights?: VoiceRights
  parameters?: JsonObject
  createdAt?: string
}

/** A reviewable JSON edit plan; generated candidates never select themselves. */
export interface VoiceAuthoringEditPlan {
  expectedRevision: string
  ledger: VoiceLedger
  catalog: AdvAssetManifest
  addedAssets: AdvAssetEntry[]
  addedTakes: VoiceTake[]
  /** Hosts copy verified immutable media only when applying this plan. */
  media: Array<{ candidate: AdvVoiceCandidate, asset: AdvAssetEntry }>
}

export interface VoiceTakeSelectInput {
  lineId: string
  locale: string
  takeId: string | null
  expectedRevision: string
  /** Replacing a different selected take is an explicit author decision. */
  replaceSelected?: boolean
}

/** Adopt a verified server receipt without changing its immutable public identity. */
export interface VoiceTakeImportInput extends VoiceTakeBindingInput {
  take: VoiceTake
  asset: AdvAssetEntry
  expectedRevision: string
}

/** The host supplies its finite ProjectWorkspace transaction and native synthesis. */
export interface VoiceAuthoringAdapter {
  read: () => Promise<VoiceAuthoringSnapshot>
  commit: (plan: VoiceAuthoringEditPlan) => Promise<VoiceAuthoringSnapshot>
  synthesize?: (input: { lineId: string, locale: string, speakerId: string, text: string }, signal?: AbortSignal) => Promise<AdvVoiceSynthesisResult>
  verifyTake?: (input: { lineId: string, locale: string, takeId: string }) => Promise<void>
}

export interface VoiceAuthoringService {
  read: () => Promise<VoiceAuthoringSnapshot>
  /** Verify persisted immutable bytes without changing any selected take. */
  verifyTake?: (input: { lineId: string, locale: string, takeId: string }) => Promise<void>
  synthesize: (input: { lineId: string, locale: string, speakerId: string, displayText: string, spokenText?: string, expectedRevision?: string }, signal?: AbortSignal) => Promise<AdvVoiceSynthesisResult>
  register: (input: VoiceTakeBindingInput & { expectedRevision: string }) => Promise<VoiceAuthoringSnapshot>
  /** Exact receipt import; hosts still verify local bytes and commit with revision CAS. */
  importTake?: (input: VoiceTakeImportInput) => Promise<VoiceAuthoringSnapshot>
  select: (input: VoiceTakeSelectInput) => Promise<VoiceAuthoringSnapshot>
}
