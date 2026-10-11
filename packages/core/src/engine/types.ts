import type { RuntimeAudioState } from '@advjs/types'

export interface TachieRich {
  name: string
  status?: string
  appearance?: string
}

export interface PlayStageState {
  background: string
  audio: RuntimeAudioState
  tachies: Record<string, { status: string }>
  tachieAscii: string[]
  tachieRich?: TachieRich[]
}

export interface FormattedOutputMeta {
  stage?: PlayStageState
}

export type FormattedOutput
  = | ({ type: 'dialog', text: string, character: string, status?: string } & FormattedOutputMeta)
    | ({ type: 'narration', text: string } & FormattedOutputMeta)
    | ({ type: 'choices', text: string, options: { index: number, label: string }[] } & FormattedOutputMeta)
    | ({ type: 'scene', text: string, place?: string, time?: string } & FormattedOutputMeta)
    | ({ type: 'text', text: string } & FormattedOutputMeta)
    | ({ type: 'end', text: string } & FormattedOutputMeta)
