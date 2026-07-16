import type { JsonObject } from './json'
import type { RuntimeAddress, RuntimeEffect } from './program'

export type RuntimeStatus
  = | 'idle'
    | 'playing'
    | 'waiting-choice'
    | 'waiting-activity'
    | 'ended'
    | 'error'

export interface RuntimeTachieState {
  status: string
}

export interface RuntimeStageState {
  background: string
  bgm: string
  tachies: Record<string, RuntimeTachieState>
}

export interface RuntimeErrorData {
  code: string
  message: string
}

export interface RuntimeChoiceRecord {
  node: RuntimeAddress
  choiceId: string
}

export interface RuntimeState {
  status: RuntimeStatus
  cursor: RuntimeAddress
  variables: JsonObject
  stage: RuntimeStageState
  choices: RuntimeChoiceRecord[]
  visited: string[]
  error?: RuntimeErrorData
}

export interface RuntimeUpdate {
  state: RuntimeState
  effects: RuntimeEffect[]
}
