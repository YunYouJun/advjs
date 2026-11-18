import type { AdvGameConfig, RuntimeState } from '@advjs/types'
import type { DeepReadonly, Ref } from 'vue'
import { unlockedExtraIds } from '@advjs/core'
import { readonly, ref } from 'vue'

export interface BrowserExtrasOptions {
  storage?: Storage
  prefix?: string
}

export interface RuntimeExtrasCapture {
  endings: string[]
  achievements: string[]
}

/**
 * Host-owned, append-only record behind the extras menu. Unlike progression
 * variables it survives loading an older save, and it never enters the runtime.
 */
export interface RuntimeExtrasController {
  readonly storageKey: string
  /** Route node addresses (`chapter#anchor`) reached in any playthrough. */
  readonly visited: DeepReadonly<Ref<string[]>>
  /** BGM asset IDs that became the current track. */
  readonly heard: DeepReadonly<Ref<string[]>>
  readonly endings: DeepReadonly<Ref<string[]>>
  readonly achievements: DeepReadonly<Ref<string[]>>
  /** Merge one runtime state and return IDs recorded for the first time. */
  capture: (state: Readonly<RuntimeState>, routeNodes?: ReadonlySet<string>) => RuntimeExtrasCapture
  clear: () => void
}

type ExtrasGameConfig = Pick<AdvGameConfig, 'title' | 'progression' | 'gallery' | 'endings' | 'achievements'>

interface StoredExtras {
  schemaVersion: 1
  visited: string[]
  heard: string[]
  endings: string[]
  achievements: string[]
}

const FIELDS = ['visited', 'heard', 'endings', 'achievements'] as const

/** One record per game, sharing the progression namespace when it exists. */
export function extrasNamespace(config: ExtrasGameConfig) {
  return config.progression?.id ?? config.gallery?.id ?? (config.title || 'adv-game')
}

function readStored(storage: Storage, key: string): StoredExtras {
  const empty: StoredExtras = { schemaVersion: 1, visited: [], heard: [], endings: [], achievements: [] }
  try {
    const raw = storage.getItem(key)
    const parsed = raw ? JSON.parse(raw) as Partial<StoredExtras> : undefined
    if (!parsed || parsed.schemaVersion !== 1)
      return empty
    for (const field of FIELDS) {
      const value = parsed[field]
      empty[field] = Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string'))] : []
    }
    return empty
  }
  catch {
    return empty
  }
}

export function createBrowserExtrasController(
  config: ExtrasGameConfig,
  options: BrowserExtrasOptions = {},
): RuntimeExtrasController {
  const storage = options.storage ?? globalThis.localStorage
  const storageKey = `${options.prefix ?? 'advjs:extras:'}${encodeURIComponent(extrasNamespace(config))}:v1`
  const stored = readStored(storage, storageKey)
  const records = {
    visited: ref(stored.visited),
    heard: ref(stored.heard),
    endings: ref(stored.endings),
    achievements: ref(stored.achievements),
  }

  function persist() {
    const value: StoredExtras = {
      schemaVersion: 1,
      visited: records.visited.value,
      heard: records.heard.value,
      endings: records.endings.value,
      achievements: records.achievements.value,
    }
    try {
      storage.setItem(storageKey, JSON.stringify(value))
    }
    catch {
      // The record stays available in memory when storage is unavailable.
    }
  }

  function merge(field: typeof FIELDS[number], values: readonly string[]) {
    const known = new Set(records[field].value)
    const added: string[] = []
    for (const value of values) {
      if (known.has(value))
        continue
      known.add(value)
      added.push(value)
    }
    if (added.length)
      records[field].value = [...records[field].value, ...added]
    return added
  }

  return {
    storageKey,
    visited: readonly(records.visited),
    heard: readonly(records.heard),
    endings: readonly(records.endings),
    achievements: readonly(records.achievements),
    capture(state, routeNodes) {
      const bgm = state.stage.audio.bgm?.assetId
      const changed = [
        merge('visited', routeNodes ? state.visited.filter(address => routeNodes.has(address)) : state.visited),
        merge('heard', bgm ? [bgm] : []),
      ]
      const captured = {
        endings: merge('endings', unlockedExtraIds(config.endings, 'endings', state.variables)),
        achievements: merge('achievements', unlockedExtraIds(config.achievements, 'achievements', state.variables)),
      }
      if (changed.some(added => added.length) || captured.endings.length || captured.achievements.length)
        persist()
      return captured
    },
    clear() {
      for (const field of FIELDS)
        records[field].value = []
      try {
        storage.removeItem(storageKey)
      }
      catch {
        // In-memory state is still cleared.
      }
    },
  }
}
