import { computed, ref } from 'vue'
import { getCurrentProjectId } from '../utils/projectScope'

export interface RecentItem {
  /** File path or content id */
  id: string
  /** Display label */
  label: string
  /** 'chapter' | 'character' | 'scene' | 'file' */
  type: string
  /** Timestamp of last access */
  timestamp: number
}

const STORAGE_KEY = 'advjs-studio-recent'
const MAX_ITEMS = 8

const items = ref<RecentItem[]>([])
let loaded = false

function storageKey(): string {
  return `${STORAGE_KEY}-${getCurrentProjectId()}`
}

function loadItems(): RecentItem[] {
  try {
    const raw = localStorage.getItem(storageKey())
    return raw ? JSON.parse(raw) as RecentItem[] : []
  }
  catch {
    return []
  }
}

function persistItems(list: RecentItem[]) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(list))
  }
  catch {
    // storage full
  }
}

/**
 * Track recently accessed project items (chapters, characters, scenes, files).
 *
 * Shared singleton — persisted to localStorage per project.
 */
export function useRecentActivity() {
  if (!loaded) {
    items.value = loadItems()
    loaded = true
  }

  const recentItems = computed(() => items.value.slice(0, MAX_ITEMS))

  /**
   * Record an item access. Moves it to the top if already tracked.
   */
  function trackAccess(item: Omit<RecentItem, 'timestamp'>) {
    const list = loadItems()
    const existing = list.findIndex(i => i.id === item.id)
    if (existing >= 0)
      list.splice(existing, 1)

    list.unshift({ ...item, timestamp: Date.now() })

    // Trim to max
    if (list.length > MAX_ITEMS)
      list.length = MAX_ITEMS

    items.value = list
    persistItems(list)
  }

  function $reset() {
    items.value = []
    loaded = false
    try {
      localStorage.removeItem(storageKey())
    }
    catch {
      // ignore
    }
  }

  return {
    recentItems,
    trackAccess,
    $reset,
  }
}
