import type { RuntimeAddress, RuntimeNode } from '@advjs/types'

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

export interface RuntimeChapterInput {
  id: string
  title?: string
  entry: string
  nodes: RuntimeNode[]
}

export interface RuntimeProgramInput {
  id: string
  entry: RuntimeAddress
  chapters: RuntimeChapterInput[]
  requiredPlugins?: Record<string, string>
}
