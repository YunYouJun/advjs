/**
 * Input shape checks. Runtime exception text differs between V8 and
 * JavaScriptCore, so malformed input is rejected here with stable codes
 * before any shared module sees it.
 */
import { EngineFailure } from './protocol'

export type Input = Record<string, unknown>

function invalid(field: string, expected: string): EngineFailure {
  return new EngineFailure('ENGINE_INVALID_INPUT', `${field} must be ${expected}`, field)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function requireObject(input: Input, field: string): Record<string, unknown> {
  const value = input[field]
  if (!isRecord(value))
    throw invalid(field, 'an object')
  return value
}

export function optionalObject(input: Input, field: string): Record<string, unknown> | undefined {
  return input[field] === undefined ? undefined : requireObject(input, field)
}

export function requireString(input: Input, field: string): string {
  const value = input[field]
  if (typeof value !== 'string')
    throw invalid(field, 'a string')
  return value
}

export function optionalString(input: Input, field: string): string | undefined {
  return input[field] === undefined ? undefined : requireString(input, field)
}

export function optionalBoolean(input: Input, field: string): boolean | undefined {
  const value = input[field]
  if (value !== undefined && typeof value !== 'boolean')
    throw invalid(field, 'a boolean')
  return value as boolean | undefined
}

/** Project snapshot: project-relative path → UTF-8 text. */
export function requireFileMap(input: Input, field = 'files'): Record<string, string> {
  const value = requireObject(input, field)
  for (const [path, content] of Object.entries(value)) {
    if (typeof content !== 'string')
      throw invalid(`${field}.${path}`, 'a string')
  }
  return value as Record<string, string>
}

export function optionalStringArray(input: Input, field: string): string[] | undefined {
  const value = input[field]
  if (value === undefined)
    return undefined
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string'))
    throw invalid(field, 'an array of strings')
  return value as string[]
}

export function optionalStringRecord(input: Input, field: string): Record<string, string> | undefined {
  const value = optionalObject(input, field)
  if (value && Object.values(value).some(item => typeof item !== 'string'))
    throw invalid(field, 'an object of strings')
  return value as Record<string, string> | undefined
}

export function requireArray(input: Input, field: string): unknown[] {
  const value = input[field]
  if (!Array.isArray(value))
    throw invalid(field, 'an array')
  return value
}
