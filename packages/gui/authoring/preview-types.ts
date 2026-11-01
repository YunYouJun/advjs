/** In-memory authoring host. No source writes, player saves or runtime schema assumptions. */
export interface AuthoringPreviewHost<Command, View> {
  inspect: () => View
  dispatch: (command: Command) => void | Promise<void>
  back: () => void | Promise<void>
}
export interface AuthoringPreviewAdapter<Source, Command, View> {
  /** Create an isolated run. The host must not mutate or retain the live source. */
  create: (source: Source) => AuthoringPreviewHost<Command, View> | Promise<AuthoringPreviewHost<Command, View>>
  revision: (source: Source) => string
}
export type PreviewScalar = string | number | boolean | null
export interface PreviewVariable {
  id: string
  label: string
  controlLabel?: string
  type: 'string' | 'number' | 'boolean'
  value: PreviewScalar | undefined
  options?: readonly { label: string, value: PreviewScalar }[]
  optional?: boolean
  readonly?: boolean
  min?: number
  max?: number
  step?: number
}
export interface PreviewVariableGroup {
  id: string
  label: string
  description?: string
  /** Undefined renders an ordinary heading; true/false renders open/closed details. */
  expanded?: boolean
  variables: readonly PreviewVariable[]
}
export interface PreviewDialogue {
  node: string
  speaker: string
  text: string
  choices: readonly { id: string, label: string }[]
  hiddenChoices: number
  canContinue: boolean
  canClose: boolean
}
export interface PreviewTraceItem {
  sequence: number
  label: string
  messages: readonly string[]
  changes: readonly { key: string, before: unknown, after: unknown }[]
}
export interface PreviewCursor {
  id: string
  label: string
  node: string
  active: boolean
}
