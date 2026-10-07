import type { RuntimeNode, RuntimeState, RuntimeTraceEntry } from '@advjs/types'
import type {} from 'devframe'
import type { JsonHighlightToken } from '../../shared/json-highlight'

export const DEVTOOLS_EVENT = 'advjs:devtools:snapshot'
export const DEVTOOLS_RUNTIME_EVENT = 'advjs:devtools:runtime'
export const DEVTOOLS_BASE = '/__advjs_devtools/'

export interface DevToolsResource {
  type: 'chapter' | 'character' | 'scene' | 'bgm' | 'cg'
  id: string
  name: string
}

export interface DevToolsDiagnostic {
  severity: string
  code: string
  message: string
  source?: { file?: string, line?: number, column?: number }
}

export interface DevToolsSnapshot {
  title: string
  url: string
  state: RuntimeState
  current?: RuntimeNode
  program?: { id: string, hash: string, chapters: number, nodes: number }
  trace: RuntimeTraceEntry[]
  resources: DevToolsResource[]
  diagnostics: DevToolsDiagnostic[]
}

export interface DevToolsSession {
  id: string
  updatedAt: number
  snapshot: DevToolsSnapshot
}

export interface DevToolsReport {
  project: { root: string, title?: string }
  sessions: DevToolsSession[]
}

export interface AdvDevToolsOptions {
  /** Customize the same-origin panel mount. */
  base?: string
  project?: DevToolsReport['project']
}

declare module 'devframe' {
  interface DevframeRpcServerFunctions {
    'advjs-devtools:inspect': () => DevToolsReport
    'advjs-devtools:highlight-json': (code: string) => Promise<JsonHighlightToken[] | undefined>
  }
}
