import type { JsonObject, JsonValue, RuntimeVariableChange } from '@advjs/types'
import { cloneJsonData } from '../utils/json'

function isObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function equal(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  if (Object.is(left, right))
    return true
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => equal(value, right[index]))
  }
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left).sort()
    const rightKeys = Object.keys(right).sort()
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && equal(left[key], right[key]))
  }
  return false
}

function escapeSegment(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('.', '\\.')
}

function change(
  path: string,
  before: JsonValue | undefined,
  after: JsonValue | undefined,
): RuntimeVariableChange {
  return {
    path,
    ...(before === undefined ? {} : { before: cloneJsonData(before) }),
    ...(after === undefined ? {} : { after: cloneJsonData(after) }),
  }
}

export function diffRuntimeVariables(
  before: Readonly<JsonObject>,
  after: Readonly<JsonObject>,
): RuntimeVariableChange[] {
  const changes: RuntimeVariableChange[] = []

  const visit = (path: string, left: JsonValue | undefined, right: JsonValue | undefined) => {
    if (equal(left, right))
      return
    if (isObject(left) && isObject(right)) {
      const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
      for (const key of keys) {
        const childPath = path ? `${path}.${escapeSegment(key)}` : escapeSegment(key)
        visit(childPath, left[key], right[key])
      }
      return
    }
    changes.push(change(path, left, right))
  }

  visit('', before as JsonObject, after as JsonObject)
  return changes.sort((left, right) => left.path.localeCompare(right.path))
}
