import type { Ref } from 'vue'
import type { AGUIAssetsExplorerState } from './useAssetsExplorer'
import type { FileOperations } from './useFileOperations'
import { watchEffect } from 'vue'

export function useExplorerKeyboard(
  state: AGUIAssetsExplorerState,
  ops: FileOperations,
  containerRef: Ref<HTMLElement | undefined>,
) {
  const { selection, curFileList } = state

  function handleKeydown(e: KeyboardEvent) {
    // Don't intercept if renaming
    if (selection.renamingItem.value)
      return

    // Don't intercept if target is an input/textarea
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA')
      return

    const isMod = e.ctrlKey || e.metaKey

    switch (e.key) {
      case 'Delete':
      case 'Backspace': {
        if (selection.selectedItems.size > 0) {
          e.preventDefault()
          ops.deleteItems([...selection.selectedItems])
        }
        break
      }
      case 'F2': {
        if (selection.selectedItems.size === 1) {
          e.preventDefault()
          const item = [...selection.selectedItems][0]
          selection.startRenaming(item)
        }
        break
      }
      case 'c': {
        if (isMod && selection.selectedItems.size > 0) {
          e.preventDefault()
          ops.copyItems([...selection.selectedItems])
        }
        break
      }
      case 'x': {
        if (isMod && selection.selectedItems.size > 0) {
          e.preventDefault()
          ops.cutItems([...selection.selectedItems])
        }
        break
      }
      case 'v': {
        if (isMod) {
          e.preventDefault()
          ops.pasteItems()
        }
        break
      }
      case 'd': {
        if (isMod && selection.selectedItems.size > 0) {
          e.preventDefault()
          ops.duplicateItems([...selection.selectedItems])
        }
        break
      }
      case 'a': {
        if (isMod) {
          e.preventDefault()
          selection.selectAll(curFileList.value)
        }
        break
      }
      case 'Enter': {
        if (selection.selectedItems.size === 1) {
          e.preventDefault()
          // Trigger dblclick on the selected item
          const el = containerRef.value?.querySelector('.agui-file-item.selected')
          el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        }
        break
      }
      case 'Escape': {
        e.preventDefault()
        selection.clearSelection()
        break
      }
    }
  }

  watchEffect((onCleanup) => {
    const el = containerRef.value
    if (!el)
      return
    el.addEventListener('keydown', handleKeydown)
    onCleanup(() => {
      el.removeEventListener('keydown', handleKeydown)
    })
  })

  return { handleKeydown }
}
