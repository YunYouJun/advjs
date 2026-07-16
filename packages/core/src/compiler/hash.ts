import type { JsonValue, RuntimeProgram } from '@advjs/types'

function compareKeys(left: string, right: string): number {
  if (left < right)
    return -1
  if (left > right)
    return 1
  return 0
}

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value))
    return value.map(sortJson)

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareKeys(left, right))
        .map(([key, child]) => [key, sortJson(child)]),
    )
  }

  return value
}

export async function hashRuntimeProgram(program: Omit<RuntimeProgram, 'hash'>): Promise<string> {
  const jsonValue = JSON.parse(JSON.stringify(program)) as JsonValue
  const canonical = JSON.stringify(sortJson(jsonValue))
  const bytes = new TextEncoder().encode(canonical)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(
    new Uint8Array(digest),
    byte => byte.toString(16).padStart(2, '0'),
  ).join('')
}
