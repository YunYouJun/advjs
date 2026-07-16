import type { RuntimeSaveRecord } from './types'
import { RUNTIME_SNAPSHOT_SCHEMA_VERSION } from '@advjs/types'

export class RuntimeSaveRecordError extends Error {
  readonly code = 'ADV_RUNTIME_INVALID_SAVE_RECORD'

  constructor(message: string) {
    super(`ADV_RUNTIME_INVALID_SAVE_RECORD: ${message}`)
    this.name = 'RuntimeSaveRecordError'
  }
}

function invalid(message: string): never {
  throw new RuntimeSaveRecordError(message)
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
      invalid(`${path} must contain finite numbers`)
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

export function validateRuntimeSaveRecord(value: unknown): RuntimeSaveRecord {
  assertJsonData(value, 'record', new Set())
  if (!isRecord(value))
    invalid('record must be an object')
  if (typeof value.id !== 'string' || !value.id)
    invalid('record.id must be a non-empty string')
  if (!Number.isFinite(value.updatedAt))
    invalid('record.updatedAt must be finite')
  if (value.metadata !== undefined && !isRecord(value.metadata))
    invalid('record.metadata must be an object')

  const snapshot = value.snapshot
  if (!isRecord(snapshot))
    invalid('record.snapshot must be an object')
  if (snapshot.schemaVersion !== RUNTIME_SNAPSHOT_SCHEMA_VERSION)
    invalid(`unsupported snapshot schema: ${String(snapshot.schemaVersion)}`)
  if (!isRecord(snapshot.program)
    || typeof snapshot.program.id !== 'string'
    || typeof snapshot.program.hash !== 'string') {
    invalid('record.snapshot.program is invalid')
  }
  if (!isRecord(snapshot.state) || !Array.isArray(snapshot.checkpoints))
    invalid('record.snapshot runtime data is invalid')
  if (!Number.isFinite(snapshot.createdAt))
    invalid('record.snapshot.createdAt must be finite')

  return structuredClone(value) as unknown as RuntimeSaveRecord
}
