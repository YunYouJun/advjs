import type { AudioAssetKind, VoiceGenerationJob } from '@advjs/audio'
import type { AdvAssetEntry, AdvVoiceCandidate, JsonObject, VoiceDesignFileChange, VoiceRights, VoiceTake, VoiceTakeSource } from '@advjs/types'
import type { EditorVoiceJobsPlanInput, EditorVoiceJobsReviewedPlan, EditorVoiceJobsSnapshot } from './editor-audio'

/** Versioned HTTP surface. Accounts and native coordinates come from the host. */
export const STUDIO_VOICE_API_PREFIX = '/v1/audio/projects'

export interface HostedVoiceJobsSnapshot extends EditorVoiceJobsSnapshot {
  accountId: string
  projectId: string
  providerConcurrency: Record<string, number>
  canQuery: boolean
}

export interface HostedVoicePrepareInput {
  lineId: string
  locale: string
  providerId: string
}

export interface HostedVoicePreparedInput extends HostedVoicePrepareInput {
  speakerId: string
  voiceId: string
  model: string
  source: VoiceTakeSource
  rights?: VoiceRights
  voiceProfileRevision: string
  parameters?: JsonObject
  inputFingerprint: string
  characterCount: number
  /** Relative native destination, never a machine path or signed URL. */
  assetPath: string
}

/** Registered immutable results can be downloaded and imported without billing. */
export interface HostedVoiceReceipt {
  taskId: string
  lineId: string
  locale: string
  speakerId: string
  inputFingerprint: string
  take: VoiceTake
  asset: AdvAssetEntry
  candidate: Omit<AdvVoiceCandidate, 'path' | 'text' | 'characterId' | 'inputFingerprint'>
  assetPath: string
  /** Relative authenticated route on this service origin. */
  mediaUrl: string
}

export interface HostedVoiceSyncInput {
  expectedRevision: string
  /** Finite native authoring documents only. No executable project config. */
  files: Record<string, string>
}

export interface HostedVoiceSyncState {
  revision: string
  /** Canonical merge edits against the exact uploaded native bytes; absent on GET. */
  changes?: VoiceDesignFileChange[]
  missingMedia: Array<{ assetId: string, sha256: string, bytes?: number, mimeType?: string, kind: AudioAssetKind }>
}

export type HostedVoicePlanInput = EditorVoiceJobsPlanInput
export type HostedVoiceReviewedPlan = EditorVoiceJobsReviewedPlan

export interface HostedVoiceReceipts {
  job: VoiceGenerationJob
  receipts: HostedVoiceReceipt[]
}

/** Public review metadata; processing evidence and media paths remain on the host. */
export interface HostedAudioReleaseReview {
  planId: string
  sourceRevision: string
  expectedManifestRevision: string | null
  expiresAt: string
  assetCount: number
  objectCount: number
  bytes: number
  assets: Array<{ id: string, kind: string, title: string }>
}

export interface HostedAudioPublication {
  revision: string
  manifestObjectKey: string
  manifestUrl: string
  publishedAt: string
}

export interface HostedAudioReleasePreparation {
  id: string
  status: 'queued' | 'running' | 'ready' | 'failed'
  review?: HostedAudioReleaseReview
  error?: string
}
