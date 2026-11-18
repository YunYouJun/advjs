import type { AdvGameProgressionConfig, JsonObject } from '@advjs/types'
import { diffRuntimeVariables } from '@advjs/core'

export interface BrowserRuntimeProgressionOptions {
  storage?: Storage
  prefix?: string
  /** Configured ending and achievement lists accumulate unlocked IDs. */
  unlockKeys?: readonly string[]
}

export interface RuntimeProgressionController {
  readonly storageKey: string
  restore: (initialVariables: JsonObject) => JsonObject
  capture: (variables: Readonly<JsonObject>, previous?: Readonly<JsonObject>) => void
  clear: () => void
}

interface StoredRuntimeProgression {
  schemaVersion: 1
  variables: JsonObject
}

const VARIABLE_KEY_PATTERN = /^[A-Za-z_][\w-]*$/u
const FORBIDDEN_VARIABLE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject
}

function normalizedConfig(config: AdvGameProgressionConfig) {
  if (typeof config.id !== 'string' || !config.id.trim())
    throw new TypeError('progression.id must be a non-empty string')

  const version = config.version ?? 1
  if (!Number.isInteger(version) || version < 1)
    throw new TypeError('progression.version must be a positive integer')
  if (!Array.isArray(config.keys) || config.keys.length === 0)
    throw new TypeError('progression.keys must contain at least one top-level variable key')

  const keys = config.keys.map((key) => {
    if (typeof key !== 'string' || !VARIABLE_KEY_PATTERN.test(key) || FORBIDDEN_VARIABLE_KEYS.has(key))
      throw new TypeError(`Invalid progression variable key: ${String(key)}`)
    return key
  })
  if (new Set(keys).size !== keys.length)
    throw new TypeError('progression.keys must not contain duplicates')

  return {
    id: config.id,
    version,
    keys,
  }
}

function storedVariables(value: string | null): JsonObject | undefined {
  if (!value)
    return undefined
  try {
    const record = JSON.parse(value) as Partial<StoredRuntimeProgression>
    if (!record || typeof record !== 'object' || Array.isArray(record))
      return undefined
    if (record.schemaVersion !== 1)
      return undefined
    if (!record.variables || typeof record.variables !== 'object' || Array.isArray(record.variables))
      return undefined
    return cloneJsonObject(record.variables)
  }
  catch {
    return undefined
  }
}

export function createBrowserRuntimeProgression(
  config: AdvGameProgressionConfig,
  options: BrowserRuntimeProgressionOptions = {},
): RuntimeProgressionController {
  const normalized = normalizedConfig(config)
  const storage = options.storage ?? globalThis.localStorage
  const prefix = options.prefix ?? 'advjs:progression:'
  const storageKey = `${prefix}${encodeURIComponent(normalized.id)}:v${normalized.version}`
  const unlockKeys = new Set(options.unlockKeys)

  function read() {
    try {
      return storedVariables(storage.getItem(storageKey))
    }
    catch {
      return undefined
    }
  }

  return {
    storageKey,
    restore(initialVariables) {
      const restored = cloneJsonObject(initialVariables)
      const saved = read()
      if (!saved)
        return restored

      for (const key of normalized.keys) {
        if (Object.hasOwn(saved, key))
          restored[key] = structuredClone(saved[key])
      }
      return restored
    },
    capture(variables, previous) {
      const changed = previous
        ? new Set(diffRuntimeVariables(previous, variables).map(change => change.path.split('.', 1)[0]))
        : undefined
      if (changed && !normalized.keys.some(key => changed.has(key)))
        return
      const saved = read()
      const selected: JsonObject = {}
      for (const key of normalized.keys) {
        const source = changed && !changed.has(key) ? saved : variables
        const value = source && Object.hasOwn(source, key) ? source[key] : undefined
        const unlocked = saved?.[key]
        if (unlockKeys.has(key) && Array.isArray(unlocked)) {
          selected[key] = [...new Set([...unlocked, ...Array.isArray(value) ? value : []])]
        }
        else if (value !== undefined) {
          selected[key] = structuredClone(value)
        }
      }
      const record: StoredRuntimeProgression = {
        schemaVersion: 1,
        variables: selected,
      }
      storage.setItem(storageKey, JSON.stringify(record))
    },
    clear() {
      storage.removeItem(storageKey)
    },
  }
}
