import type { JsonObject, RuntimeAddress } from '@advjs/types'

export interface CompileSourceLocation {
  file?: string
  line?: number
  column?: number
}

export interface CompileDiagnostic {
  code: string
  severity: 'error' | 'warning'
  message: string
  source?: CompileSourceLocation
}

export interface CompileResult<T> {
  program?: T
  diagnostics: CompileDiagnostic[]
}

export type RuntimeTargetInput = RuntimeAddress | string

export interface RuntimeChoiceInput {
  id: string
  label: string
  target?: RuntimeTargetInput
  source?: CompileSourceLocation
}

export interface RuntimeNodeInput {
  id: string
  kind: string
  data?: JsonObject
  next?: RuntimeTargetInput
  choices?: RuntimeChoiceInput[]
  source?: CompileSourceLocation
}

export interface RuntimeChapterInput {
  id: string
  title?: string
  entry: string
  nodes: RuntimeNodeInput[]
}

export interface RuntimeProgramInput {
  id: string
  entry: RuntimeAddress
  chapters: RuntimeChapterInput[]
  requiredPlugins?: Record<string, string>
}
