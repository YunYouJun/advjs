import type { TachiePosition } from '../ast'
import type { JsonObject } from './json'
import type { RuntimeAddress, RuntimeEffect } from './program'

export const RUNTIME_SNAPSHOT_SCHEMA_VERSION = 1 as const

export type RuntimeStatus
  = | 'idle'
    | 'playing'
    | 'waiting-choice'
    | 'waiting-activity'
    | 'ended'
    | 'error'

export interface RuntimeTachieState {
  status: string
  position?: TachiePosition
  scale?: number
  mirror?: boolean
}

export interface RuntimeStageState {
  background: string
  bgm: string
  cg: string
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

export interface RuntimePendingActivity {
  id: string
  type: string
  input: JsonObject
  node: RuntimeAddress
}

export interface RuntimeState {
  status: RuntimeStatus
  cursor: RuntimeAddress
  variables: JsonObject
  stage: RuntimeStageState
  choices: RuntimeChoiceRecord[]
  visited: string[]
  pendingActivity?: RuntimePendingActivity
  error?: RuntimeErrorData
}

export interface RuntimeUpdate {
  state: RuntimeState
  effects: RuntimeEffect[]
}

export interface RuntimeCheckpoint {
  id: string
  state: RuntimeState
  createdAt: number
}

export interface RuntimeSnapshot {
  schemaVersion: typeof RUNTIME_SNAPSHOT_SCHEMA_VERSION
  program: {
    id: string
    hash: string
  }
  state: RuntimeState
  checkpoints: RuntimeCheckpoint[]
  createdAt: number
}
