import type { JsonValue } from './json'
import type { RuntimeAddress, RuntimeEffect } from './program'
import type { RuntimeStatus } from './state'

export type RuntimeCommandName
  = | 'start'
    | 'next'
    | 'choose'
    | 'go'
    | 'back'
    | 'forward'
    | 'restore'
    | 'complete-activity'

export interface RuntimeTraceInput {
  choiceId?: string
  target?: RuntimeAddress
  activityType?: string
}

export interface RuntimeVariableChange {
  path: string
  before?: JsonValue
  after?: JsonValue
}

export interface RuntimeTraceEntry {
  sequence: number
  command: RuntimeCommandName
  input?: RuntimeTraceInput
  from: RuntimeAddress
  to: RuntimeAddress
  status: RuntimeStatus
  effects: RuntimeEffect[]
  variableChanges: RuntimeVariableChange[]
}
