import type { FSItem } from '../components/explorer/types'
import { ref, shallowReactive } from 'vue'

export interface ClipboardState {
  items: FSItem[]
  mode: 'copy' | 'cut'
}

export function useFileSelection() {
  const selectedItems = shallowReactive(new Set<FSItem>())
  const lastSelectedItem = ref<FSItem>()
  const renamingItem = ref<FSItem>()
  const clipboard = ref<ClipboardState>()

  function select(item: FSItem) {
    selectedItems.clear()
    selectedItems.add(item)
    lastSelectedItem.value = item
  }

  function toggleSelect(item: FSItem) {
    if (selectedItems.has(item)) {
      selectedItems.delete(item)
    }
    else {
      selectedItems.add(item)
    }
    lastSelectedItem.value = item
  }

  function rangeSelect(item: FSItem, list: FSItem[]) {
    const lastItem = lastSelectedItem.value
    if (!lastItem) {
      select(item)
      return
    }

    const startIndex = list.indexOf(lastItem)
    const endIndex = list.indexOf(item)
    if (startIndex === -1 || endIndex === -1) {
      select(item)
      return
    }

    const min = Math.min(startIndex, endIndex)
    const max = Math.max(startIndex, endIndex)
    selectedItems.clear()
    for (let i = min; i <= max; i++)
      selectedItems.add(list[i])

    lastSelectedItem.value = item
  }

  function selectAll(list: FSItem[]) {
    selectedItems.clear()
    for (const item of list)
      selectedItems.add(item)
  }

  function clearSelection() {
    selectedItems.clear()
    lastSelectedItem.value = undefined
  }

  function isSelected(item: FSItem) {
    return selectedItems.has(item)
  }

  function startRenaming(item: FSItem) {
    renamingItem.value = item
  }

  function stopRenaming() {
    renamingItem.value = undefined
  }

  function setClipboard(items: FSItem[], mode: 'copy' | 'cut') {
    clipboard.value = { items: [...items], mode }
  }

  function clearClipboard() {
    clipboard.value = undefined
  }

  return {
    selectedItems,
    lastSelectedItem,
    renamingItem,
    clipboard,

    select,
    toggleSelect,
    rangeSelect,
    selectAll,
    clearSelection,
    isSelected,

    startRenaming,
    stopRenaming,

    setClipboard,
    clearClipboard,
  }
}

export type FileSelectionState = ReturnType<typeof useFileSelection>
