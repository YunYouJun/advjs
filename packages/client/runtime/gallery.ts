import type { AdvGameGalleryConfig } from '@advjs/types'
import type { DeepReadonly, Ref } from 'vue'
import { readonly, ref } from 'vue'

export interface BrowserGalleryOptions {
  storage?: Storage
  prefix?: string
}

export interface RuntimeGalleryController {
  readonly storageKey: string
  readonly unlocked: DeepReadonly<Ref<string[]>>
  unlock: (id: string) => boolean
  isUnlocked: (id: string) => boolean
  clear: () => void
}

interface StoredGallery {
  schemaVersion: 1
  unlocked: string[]
}

function normalizedConfig(config: AdvGameGalleryConfig) {
  if (!config.id.trim())
    throw new TypeError('gallery.id must be a non-empty string')
  const version = config.version ?? 1
  if (!Number.isInteger(version) || version < 1)
    throw new TypeError('gallery.version must be a positive integer')
  const ids = config.items.map(item => item.id)
  if (ids.some(id => !id.trim()))
    throw new TypeError('gallery item ids must be non-empty strings')
  if (new Set(ids).size !== ids.length)
    throw new TypeError('gallery item ids must be unique')
  return { id: config.id, version, ids: new Set(ids) }
}

function readStored(storage: Storage, key: string, allowed: ReadonlySet<string>): string[] {
  try {
    const raw = storage.getItem(key)
    if (!raw)
      return []
    const parsed = JSON.parse(raw) as Partial<StoredGallery>
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.unlocked))
      return []
    return [...new Set(parsed.unlocked.filter(id => typeof id === 'string' && allowed.has(id)))]
  }
  catch {
    return []
  }
}

export function createBrowserGalleryController(
  config: AdvGameGalleryConfig,
  options: BrowserGalleryOptions = {},
): RuntimeGalleryController {
  const normalized = normalizedConfig(config)
  const storage = options.storage ?? globalThis.localStorage
  const storageKey = `${options.prefix ?? 'advjs:gallery:'}${encodeURIComponent(normalized.id)}:v${normalized.version}`
  const unlocked = ref(readStored(storage, storageKey, normalized.ids))

  function persist() {
    const value: StoredGallery = { schemaVersion: 1, unlocked: unlocked.value }
    storage.setItem(storageKey, JSON.stringify(value))
  }

  return {
    storageKey,
    unlocked: readonly(unlocked),
    unlock(id) {
      if (!normalized.ids.has(id) || unlocked.value.includes(id))
        return false
      unlocked.value = [...unlocked.value, id]
      try {
        persist()
      }
      catch {
        // Unlock remains available in-memory when storage is unavailable.
      }
      return true
    },
    isUnlocked: id => unlocked.value.includes(id),
    clear() {
      unlocked.value = []
      try {
        storage.removeItem(storageKey)
      }
      catch {
        // In-memory state is still cleared.
      }
    },
  }
}
