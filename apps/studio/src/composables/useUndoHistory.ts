import type { Ref } from 'vue'
import { useDebouncedRefHistory } from '@vueuse/core'

/**
 * Undo/redo history for a string ref (e.g. editor content).
 * Uses `@vueuse/core` `useDebouncedRefHistory` with debounced snapshots.
 */
export function useUndoHistory(source: Ref<string>, options?: { capacity?: number, debounce?: number }) {
  const { capacity = 50, debounce = 500 } = options ?? {}

  const { undo, redo, canUndo, canRedo } = useDebouncedRefHistory(source, {
    deep: false,
    capacity,
    debounce,
  })

  return {
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
