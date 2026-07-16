import type {
  JsonValue,
  RuntimeNode,
  RuntimePendingActivity,
  RuntimeSnapshot,
  RuntimeTraceEntry,
} from '@advjs/types'

export interface RuntimeInspectorModel {
  address: { chapterId: string, nodeId: string }
  status: RuntimeSnapshot['state']['status']
  current?: Pick<RuntimeNode, 'id' | 'kind'>
  variables: RuntimeSnapshot['state']['variables']
  stage: RuntimeSnapshot['state']['stage']
  choices: RuntimeSnapshot['state']['choices']
  visited: RuntimeSnapshot['state']['visited']
  checkpointCount: number
  pendingActivity?: RuntimePendingActivity
  trace: RuntimeTraceEntry[]
}

export interface RuntimeDebugReportOptions {
  snapshot: RuntimeSnapshot
  trace: RuntimeTraceEntry[]
  diagnostics?: JsonValue[]
}

export interface RuntimeDebugReport {
  schemaVersion: 1
  engine: 'advjs'
  program: RuntimeSnapshot['program']
  snapshot: RuntimeSnapshot
  trace: RuntimeTraceEntry[]
  diagnostics: JsonValue[]
  metadata: {
    notice: string
  }
}

export function projectRuntimeInspector(
  snapshot: RuntimeSnapshot,
  current?: RuntimeNode,
  trace: RuntimeTraceEntry[] = [],
): RuntimeInspectorModel {
  return {
    address: structuredClone(snapshot.state.cursor),
    status: snapshot.state.status,
    current: current ? { id: current.id, kind: current.kind } : undefined,
    variables: structuredClone(snapshot.state.variables),
    stage: structuredClone(snapshot.state.stage),
    choices: structuredClone(snapshot.state.choices),
    visited: structuredClone(snapshot.state.visited),
    checkpointCount: snapshot.checkpoints.length,
    pendingActivity: snapshot.state.pendingActivity
      ? structuredClone(snapshot.state.pendingActivity)
      : undefined,
    trace: structuredClone(trace),
  }
}

export function createRuntimeDebugReport(
  options: RuntimeDebugReportOptions,
): RuntimeDebugReport {
  return {
    schemaVersion: 1,
    engine: 'advjs',
    program: structuredClone(options.snapshot.program),
    snapshot: structuredClone(options.snapshot),
    trace: structuredClone(options.trace),
    diagnostics: structuredClone(options.diagnostics ?? []),
    metadata: {
      notice: 'Snapshot variables and trace diffs may contain author-defined data. Review this JSON before sharing it.',
    },
  }
}
