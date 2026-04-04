import type Dexie from 'dexie'
import type { WatchSource } from 'vue'
import { ref } from 'vue'
import { useDebouncedPersist } from './debouncedPersist'
import { getCurrentProjectId } from './projectScope'

export interface ProjectPersistenceOptions<T> {
  /** Reactive source to watch for changes */
  source: WatchSource<T>
  /** Persist current state to storage */
  save: () => Promise<void>
  /** Load state from storage for the given project */
  load: (projectId: string) => Promise<void>
  /** Clear/reset state to defaults */
  clear: () => void
  /** Debounce delay in ms (default: 800) */
  delay?: number
}

/**
 * Composable that encapsulates the common project-scoped persistence pattern:
 * `initialized` ref + `useDebouncedPersist` + `init` try/catch + `$reset` flag.
 *
 * Each store provides its own load/save/clear callbacks while this composable
 * handles the boilerplate scaffolding.
 */
export function useProjectPersistence<T>(options: ProjectPersistenceOptions<T>) {
  const initialized = ref(false)

  const { flush } = useDebouncedPersist({
    source: options.source,
    save: options.save,
    delay: options.delay,
  })

  async function init(projectId?: string) {
    const pid = projectId ?? getCurrentProjectId()
    try {
      await options.load(pid)
    }
    catch {
      // ignore — data will start fresh
    }
    initialized.value = true
  }

  function $reset() {
    options.clear()
    initialized.value = false
  }

  return { initialized, flush, init, $reset }
}

/**
 * Load rows from a Dexie table for a given project and build a Map.
 *
 * Shared by stores that persist `Map<string, T>` data
 * (characterMemory, characterState, characterChat).
 *
 * Returns `null` when no rows exist (preserving the existing "skip if empty" semantics).
 */
export async function loadMapFromDexie<T>(
  table: Dexie.Table,
  projectId: string,
  keyFn: (row: any) => string,
  valueFn: (row: any) => T,
): Promise<Map<string, T> | null> {
  const all = await table.where('projectId').equals(projectId).toArray()
  if (all.length === 0)
    return null
  const map = new Map<string, T>()
  for (const row of all)
    map.set(keyFn(row), valueFn(row))
  return map
}

/**
 * Lazy-init getter for Map entries: return existing value or create with factory.
 *
 * Shared by stores that expose `getX(characterId)` pattern
 * (characterChat, characterMemory, characterState).
 */
export function getOrCreateInMap<K, V>(
  map: Map<K, V>,
  key: K,
  factory: (key: K) => V,
): V {
  if (!map.has(key))
    map.set(key, factory(key))
  return map.get(key)!
}
