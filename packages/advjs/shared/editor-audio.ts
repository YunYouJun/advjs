import type { VoiceGenerationBudget, VoiceGenerationJob, VoiceGenerationSelectionMode } from '@advjs/audio'

export const EDITOR_VOICE_JOB_MAX_LINES = 5000
export const EDITOR_VOICE_JOB_BATCH_SIZE = 200

/** Finite authenticated authoring commands; native coordinates stay in the host. */
export interface EditorVoiceJobsSnapshot {
  configured: boolean
  unavailableCode?: string
  defaultPreset?: string
  maxLines?: number
  batchSize?: number
  /** Local host promises, including intervals before task status is updated. */
  activeJobIds?: string[]
  providers: Array<{ id: string, backend: 'local' | 'cloud', models: string[], default: boolean }>
  jobs: VoiceGenerationJob[]
}

export interface EditorVoiceJobsPlanInput {
  lineIds: string[]
  locale: string
  providerId: string
  chapterId?: string
  mode?: VoiceGenerationSelectionMode
  budget: VoiceGenerationBudget
}

export interface EditorVoiceJobsReviewedPlan {
  plan: VoiceGenerationJob
  planHash: string
  snapshotRevision: string
  selection?: { mode: VoiceGenerationSelectionMode, requestedLines: number, skippedLines: number }
}

export type EditorVoiceJobAction = 'run' | 'cancel' | 'resume' | 'retry'

export interface EditorVoiceJobsPort {
  read: (signal?: AbortSignal) => Promise<EditorVoiceJobsSnapshot>
  plan: (input: EditorVoiceJobsPlanInput, signal?: AbortSignal) => Promise<EditorVoiceJobsReviewedPlan>
  enqueue: (input: { planId: string, planHash: string }, signal?: AbortSignal) => Promise<VoiceGenerationJob>
  command: (input: { jobId: string, action: EditorVoiceJobAction, taskIds?: string[] }, signal?: AbortSignal) => Promise<VoiceGenerationJob>
}
