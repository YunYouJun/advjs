import type {
  RuntimeCheckpoint,
  RuntimeProgram,
  RuntimeSnapshot,
  RuntimeState,
} from '@advjs/types'
import { RUNTIME_SNAPSHOT_SCHEMA_VERSION } from '@advjs/types'
import { getRuntimeNode } from './state'

export class RuntimeSnapshotError extends Error {
  constructor(
    public readonly code: 'ADV_RUNTIME_INVALID_SNAPSHOT' | 'ADV_RUNTIME_SNAPSHOT_MISMATCH',
    message: string,
  ) {
    super(`${code}: ${message}`)
    this.name = 'RuntimeSnapshotError'
  }
}

function invalid(message: string): never {
  throw new RuntimeSnapshotError('ADV_RUNTIME_INVALID_SNAPSHOT', message)
}

function mismatch(message: string): never {
  throw new RuntimeSnapshotError('ADV_RUNTIME_SNAPSHOT_MISMATCH', message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertJsonData(value: unknown, path: string, ancestors: Set<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      invalid(`${path} must contain a finite number`)
    return
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value))
      invalid(`${path} must not contain a cycle`)
    ancestors.add(value)
    value.forEach((child, index) => assertJsonData(child, `${path}[${index}]`, ancestors))
    ancestors.delete(value)
    return
  }
  if (!isRecord(value))
    invalid(`${path} must contain JSON data only`)
  if (ancestors.has(value))
    invalid(`${path} must not contain a cycle`)
  ancestors.add(value)
  for (const [key, child] of Object.entries(value))
    assertJsonData(child, `${path}.${key}`, ancestors)
  ancestors.delete(value)
}

function assertRuntimeState(value: unknown, program: RuntimeProgram, path: string): asserts value is RuntimeState {
  if (!isRecord(value))
    invalid(`${path} must be an object`)

  const statuses = new Set(['idle', 'playing', 'waiting-choice', 'waiting-activity', 'ended', 'error'])
  if (typeof value.status !== 'string' || !statuses.has(value.status))
    invalid(`${path}.status is invalid`)
  if (!isRecord(value.cursor)
    || typeof value.cursor.chapterId !== 'string'
    || typeof value.cursor.nodeId !== 'string') {
    invalid(`${path}.cursor is invalid`)
  }
  if (!getRuntimeNode(program, {
    chapterId: value.cursor.chapterId,
    nodeId: value.cursor.nodeId,
  })) {
    invalid(`${path}.cursor references unknown node ${value.cursor.chapterId}#${value.cursor.nodeId}`)
  }
  if (!isRecord(value.variables))
    invalid(`${path}.variables must be an object`)
  if (!isRecord(value.stage)
    || typeof value.stage.background !== 'string'
    || typeof value.stage.bgm !== 'string'
    || !isRecord(value.stage.tachies)) {
    invalid(`${path}.stage is invalid`)
  }
  if (!Array.isArray(value.choices) || !Array.isArray(value.visited))
    invalid(`${path} history is invalid`)
}

function compareKeys(left: string, right: string): number {
  if (left < right)
    return -1
  if (left > right)
    return 1
  return 0
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(canonicalJson)
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareKeys(left, right))
        .map(([key, child]) => [key, canonicalJson(child)]),
    )
  }
  return value
}

export function runtimeStatesEqual(left: RuntimeState, right: RuntimeState): boolean {
  return JSON.stringify(canonicalJson(left)) === JSON.stringify(canonicalJson(right))
}

export function validateRuntimeSnapshot(snapshot: unknown, program: RuntimeProgram): RuntimeSnapshot {
  assertJsonData(snapshot, 'snapshot', new Set())
  if (!isRecord(snapshot))
    invalid('snapshot must be an object')
  if (snapshot.schemaVersion !== RUNTIME_SNAPSHOT_SCHEMA_VERSION)
    invalid(`unsupported schema version: ${String(snapshot.schemaVersion)}`)
  if (!isRecord(snapshot.program)
    || typeof snapshot.program.id !== 'string'
    || typeof snapshot.program.hash !== 'string') {
    invalid('snapshot.program is invalid')
  }
  if (snapshot.program.id !== program.id)
    mismatch(`program id ${snapshot.program.id} does not match ${program.id}`)
  if (snapshot.program.hash !== program.hash)
    mismatch(`program hash ${snapshot.program.hash} does not match ${program.hash}`)
  if (!Number.isFinite(snapshot.createdAt))
    invalid('snapshot.createdAt must be finite')

  assertRuntimeState(snapshot.state, program, 'snapshot.state')
  if (!Array.isArray(snapshot.checkpoints))
    invalid('snapshot.checkpoints must be an array')
  snapshot.checkpoints.forEach((checkpoint, index) => {
    if (!isRecord(checkpoint)
      || typeof checkpoint.id !== 'string'
      || !Number.isFinite(checkpoint.createdAt)) {
      invalid(`snapshot.checkpoints[${index}] is invalid`)
    }
    assertRuntimeState(checkpoint.state, program, `snapshot.checkpoints[${index}].state`)
  })

  return structuredClone(snapshot) as unknown as RuntimeSnapshot
}

export function createRuntimeSnapshot(
  program: RuntimeProgram,
  state: RuntimeState,
  checkpoints: RuntimeCheckpoint[],
  createdAt: number,
): RuntimeSnapshot {
  const snapshot: RuntimeSnapshot = {
    schemaVersion: RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    program: { id: program.id, hash: program.hash },
    state: structuredClone(state),
    checkpoints: structuredClone(checkpoints),
    createdAt,
  }
  return validateRuntimeSnapshot(snapshot, program)
}
