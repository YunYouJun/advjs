import type { JsonObject, JsonValue } from './json'

export const RUNTIME_SCHEMA_VERSION = 1 as const

export interface RuntimeAddress {
  chapterId: string
  nodeId: string
}

export interface RuntimeChoice {
  id: string
  label: string
  target?: RuntimeAddress
  when?: RuntimeExpression
  actions?: RuntimeActionCall[]
}

export type RuntimeUnaryOperator = '!' | '-'
export type RuntimeBinaryOperator
  = | '&&' | '||'
    | '==' | '!='
    | '<' | '<=' | '>' | '>='
    | '+' | '-' | '*' | '/' | '%'

export type RuntimeExpression
  = | { type: 'literal', value: JsonValue }
    | { type: 'variable', path: string[] }
    | { type: 'unary', operator: RuntimeUnaryOperator, argument: RuntimeExpression }
    | {
      type: 'binary'
      operator: RuntimeBinaryOperator
      left: RuntimeExpression
      right: RuntimeExpression
    }

export interface RuntimeActionCall {
  type: string
  args?: JsonObject
}

export interface RuntimeNode {
  id: string
  kind: string
  data?: JsonObject
  next?: RuntimeAddress
  when?: RuntimeExpression
  actions?: RuntimeActionCall[]
}

export interface RuntimeChapter {
  id: string
  title?: string
  entry: string
  order: string[]
  nodes: Record<string, RuntimeNode>
}

export interface RuntimeProgram {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION
  id: string
  hash: string
  entry: RuntimeAddress
  chapters: Record<string, RuntimeChapter>
  requiredPlugins: Record<string, string>
}

export interface RuntimeEffect {
  type: string
  payload?: JsonValue
}
