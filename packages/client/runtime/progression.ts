import type { AdvGameProgressionConfig, JsonObject } from '@advjs/types'

export interface BrowserRuntimeProgressionOptions {
  storage?: Storage
  prefix?: string
}

export interface RuntimeProgressionController {
  readonly storageKey: string
  restore: (initialVariables: JsonObject) => JsonObject
  capture: (variables: Readonly<JsonObject>) => void
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

  return {
    storageKey,
    restore(initialVariables) {
      const restored = cloneJsonObject(initialVariables)
      let value: string | null
      try {
        value = storage.getItem(storageKey)
      }
      catch {
        return restored
      }
      const saved = storedVariables(value)
      if (!saved)
        return restored

      for (const key of normalized.keys) {
        if (Object.hasOwn(saved, key))
          restored[key] = structuredClone(saved[key])
      }
      return restored
    },
    capture(variables) {
      const selected: JsonObject = {}
      for (const key of normalized.keys) {
        if (Object.hasOwn(variables, key))
          selected[key] = structuredClone(variables[key])
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
