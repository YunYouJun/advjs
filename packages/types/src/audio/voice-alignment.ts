import type { VoiceAuthoringSnapshot } from './voice'

export interface VoiceTakeAlignmentInput {
  lineId: string
  locale: string
  takeId: string
  expectedRevision: string
}

export interface VoiceAlignmentPort {
  alignTake: (input: VoiceTakeAlignmentInput, signal?: AbortSignal) => Promise<VoiceAuthoringSnapshot>
}

/** Text offsets use JavaScript UTF-16 indexes; timestamps are audio seconds. */
// eslint-disable-next-line ts/consistent-type-definitions -- Closed JSON data must be assignable to JsonValue.
export type VoiceAlignmentUnit = {
  start: number
  end: number
  startTime: number
  endTime: number
}

/** Acoustic evidence bound to exact text and immutable master audio. */
// eslint-disable-next-line ts/consistent-type-definitions -- Closed JSON data must be assignable to candidate manifests.
export type VoiceAlignment = {
  schemaVersion: 1
  text: string
  audioSha256: string
  durationSeconds: number
  engine: string
  model: string
  revision?: string
  units: VoiceAlignmentUnit[]
}
