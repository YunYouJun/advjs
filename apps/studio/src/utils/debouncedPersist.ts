import type { WatchSource } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { onScopeDispose, watch } from 'vue'

export interface DebouncedPersistOptions<T> {
  /** Reactive source to watch */
  source: WatchSource<T>
  /** Async save function — called with debounce on every change */
  save: () => Promise<void>
  /** Debounce delay in ms (default: 800) */
  delay?: number
}

/**
 * Watch a reactive source with debounce and persist via the provided save function.
 * Registers a `beforeunload` listener to flush pending writes when the tab closes.
 *
 * @returns `flush` — call to immediately persist (e.g. on manual save).
 */
export function useDebouncedPersist<T>(options: DebouncedPersistOptions<T>): { flush: () => Promise<void> } {
  const { source, save, delay = 800 } = options

  let pending = false

  const debouncedSave = useDebounceFn(async () => {
    pending = false
    try {
      await save()
    }
    catch {
      // Persist is best-effort
    }
  }, delay)

  watch(source, () => {
    pending = true
    debouncedSave()
  }, { deep: true })

  function flush(): Promise<void> {
    if (pending) {
      pending = false
      return save().catch(() => {})
    }
    return Promise.resolve()
  }

  // Ensure data is written before the page unloads
  function onBeforeUnload() {
    flush().catch(() => {})
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', onBeforeUnload)
    onScopeDispose(() => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    })
  }

  return { flush }
}
