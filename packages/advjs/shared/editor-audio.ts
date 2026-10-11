import type { VoiceGenerationBudget, VoiceGenerationJob } from '@advjs/audio'

/** Finite authenticated authoring commands; native coordinates stay in the host. */
export interface EditorVoiceJobsSnapshot {
  configured: boolean
  unavailableCode?: string
  defaultPreset?: string
  providers: Array<{ id: string, backend: 'local' | 'cloud', models: string[], default: boolean }>
  jobs: VoiceGenerationJob[]
}

export interface EditorVoiceJobsPlanInput {
  lineIds: string[]
  locale: string
  providerId: string
  budget: VoiceGenerationBudget
}

export interface EditorVoiceJobsReviewedPlan {
  plan: VoiceGenerationJob
  planHash: string
  snapshotRevision: string
}

export type EditorVoiceJobAction = 'run' | 'cancel' | 'resume' | 'retry'

export interface EditorVoiceJobsPort {
  read: (signal?: AbortSignal) => Promise<EditorVoiceJobsSnapshot>
  plan: (input: EditorVoiceJobsPlanInput, signal?: AbortSignal) => Promise<EditorVoiceJobsReviewedPlan>
  enqueue: (input: { planId: string, planHash: string }, signal?: AbortSignal) => Promise<VoiceGenerationJob>
  command: (input: { jobId: string, action: EditorVoiceJobAction, taskIds?: string[] }, signal?: AbortSignal) => Promise<VoiceGenerationJob>
}
