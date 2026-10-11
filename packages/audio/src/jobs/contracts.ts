import type { AdvVoiceCandidate, AudioPronunciationDictionary, VoiceAuthoringService, VoiceAuthoringSnapshot, VoiceTakeBindingInput } from '@advjs/types'

export interface AudioGenerationCost {
  currency: string
  /** Integer millionths of a currency unit, avoiding floating point budgets. */
  amountMicros: number
}

export interface VoiceGenerationBudget {
  maxCharacters: number
  maxCost?: AudioGenerationCost
  /** An explicit review decision when a provider cannot estimate cost. */
  allowUnknownCost: boolean
  concurrency: number
}

export type VoiceGenerationTaskStatus = 'queued' | 'running' | 'unknown' | 'generated' | 'committed' | 'failed' | 'cancelled' | 'blocked'

/** Durable state deliberately excludes dialogue prose, prompts and credentials. */
export interface VoiceGenerationTask {
  id: string
  lineId: string
  locale: string
  speakerId: string
  providerId: string
  voiceId: string
  model: string
  voiceProfileRevision: string
  inputFingerprint: string
  idempotencyKey: string
  characterCount: number
  estimatedCost: AudioGenerationCost | null
  status: VoiceGenerationTaskStatus
  attempts: number
  takeId?: string
  assetId?: string
  errorCode?: string
}

export interface VoiceGenerationJob {
  schemaVersion: 1
  id: string
  accountId: string
  projectId: string
  createdAt: string
  updatedAt: string
  expiresAt: string
  retentionDays: number
  budget: VoiceGenerationBudget
  summary: {
    lines: number
    characters: number
    cacheHits: number
    newGenerations: number
    estimatedCost: AudioGenerationCost | null
  }
  /** Reserved before dispatch; uncertain results retain their reservation. */
  chargedCharacters: number
  chargedCostMicros: number
  cancelled: boolean
  tasks: VoiceGenerationTask[]
}

export type StoredVoiceCandidate = Omit<AdvVoiceCandidate, 'text' | 'characterId' | 'inputFingerprint'>

export interface VoiceGenerationIdempotency {
  key: string
  accountId: string
  projectId: string
  inputFingerprint: string
  ownerJobId: string
  ownerTaskId: string
  dispatchId?: string
  status: 'running' | 'unknown' | 'generated' | 'committed' | 'failed'
  createdAt: string
  updatedAt: string
  expiresAt: string
  candidate?: StoredVoiceCandidate
  errorCode?: string
}

export interface VoiceGenerationStoreDocument {
  schemaVersion: 1
  jobs: Record<string, VoiceGenerationJob>
  idempotency: Record<string, VoiceGenerationIdempotency>
}

/** Hosts must atomically serialize mutations across cooperating runners. */
export interface VoiceGenerationStore {
  read: () => Promise<VoiceGenerationStoreDocument>
  mutate: <T>(mutation: (document: VoiceGenerationStoreDocument) => T) => Promise<T>
}

/** Rehydrated from current project documents, never persisted in the job store. */
export interface VoiceGenerationResolvedInput extends Omit<VoiceTakeBindingInput, 'candidate' | 'createdAt'> {
  /** Ephemeral current project dictionary; never persisted in a job or log. */
  pronunciation?: AudioPronunciationDictionary
  providerId: string
  voiceId: string
  model: string
}

export type VoiceGenerationProviderQuery
  = | { status: 'unknown' | 'running' | 'not-started' | 'failed' }
    | { status: 'completed', candidate: AdvVoiceCandidate }

export interface VoiceGenerationRunnerOptions {
  store: VoiceGenerationStore
  authoring: VoiceAuthoringService
  resolve: (task: VoiceGenerationTask, snapshot: VoiceAuthoringSnapshot) => Promise<VoiceGenerationResolvedInput>
  /** Recheck project consent documents and provider configuration before billing. */
  verifyInput?: (input: VoiceGenerationResolvedInput, snapshot: VoiceAuthoringSnapshot) => Promise<void>
  /** A provider without a query seam cannot safely retry uncertain requests. */
  query?: (task: VoiceGenerationTask, signal?: AbortSignal) => Promise<VoiceGenerationProviderQuery>
  /** Optional transport forwards the durable key to an existing provider. */
  execute?: (input: VoiceGenerationResolvedInput, context: { idempotencyKey: string, signal: AbortSignal }) => ReturnType<VoiceAuthoringService['synthesize']>
  providerConcurrency?: Record<string, number>
  now?: () => number
}
