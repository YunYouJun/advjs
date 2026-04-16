import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'

/**
 * Incremental list loading for grid layouts where virtual scrolling
 * is not practical. Shows `pageSize` items initially, and loads more
 * as the user scrolls to the bottom via `IonInfiniteScroll`.
 *
 * Usage:
 * ```vue
 * const { visibleItems, loadMore, hasMore, reset } = useIncrementalList(allItems, 30)
 * ```
 */
export function useIncrementalList<T>(
  source: Ref<T[]> | ComputedRef<T[]>,
  pageSize = 30,
) {
  const displayCount = ref(pageSize)

  const visibleItems = computed<T[]>(() =>
    source.value.slice(0, displayCount.value),
  )

  const hasMore = computed(() =>
    displayCount.value < source.value.length,
  )

  function loadMore() {
    displayCount.value = Math.min(
      displayCount.value + pageSize,
      source.value.length,
    )
  }

  function reset() {
    displayCount.value = pageSize
  }

  // Reset when source changes (e.g. search query changes)
  watch(() => source.value.length, () => {
    reset()
  })

  return {
    visibleItems,
    hasMore,
    loadMore,
    reset,
  }
}
