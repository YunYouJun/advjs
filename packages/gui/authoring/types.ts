/** Presentation data only. Hosts retain source formats, runtime state and persistence. */
export interface AuthoringDiagnostic {
  code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  path?: string
  line?: number
  column?: number
}

export interface AuthoringGraphNode {
  id: string
  title: string
  text: string
  x: number
  y: number
}
export interface AuthoringGraphEdge {
  id: string
  from: string
  to: string
  label: string
  conditional?: boolean
}
export interface AuthoringGraph {
  id: string
  entry: string
  nodes: readonly AuthoringGraphNode[]
  edges: readonly AuthoringGraphEdge[]
  width: number
  height: number
}
export interface ConditionReference { name: string, description?: string }
export interface AuthoringConditionAdapter {
  format: (value: unknown) => string
  /** Pure parser; throwing reports a parse error and never emits a source change. */
  parse: (text: string) => unknown
  /** Semantic errors remain repairable drafts; the host must gate saving independently. */
  validate?: (value: unknown) => readonly AuthoringDiagnostic[]
  references?: readonly ConditionReference[]
  examples?: readonly string[]
}
