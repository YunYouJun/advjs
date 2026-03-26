import type { AGUIContextMenuItemType } from '../components/context-menu/types'
import type { FSDirItem, FSItem } from '../components/explorer/types'
import type { AGUIAssetsExplorerState } from './useAssetsExplorer'
import type { FileOperations } from './useFileOperations'
import type { FileSelectionState } from './useFileSelection'
import { listFilesInDir } from './useAssetsExplorer'

function separator(): AGUIContextMenuItemType {
  return { type: 'separator' }
}

/**
 * Get context menu items for a file item
 */
export function getFileContextMenu(
  item: FSItem,
  ops: FileOperations,
  selection: FileSelectionState,
  _state: AGUIAssetsExplorerState,
): AGUIContextMenuItemType[] {
  return [
    {
      label: 'Open',
      accelerator: 'Enter',
      onClick: () => {
        // Trigger double-click behavior
        const el = document.querySelector('.agui-file-item.selected')
        el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      },
    },
    separator(),
    {
      label: 'Cut',
      accelerator: '⌘X',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.cutItems(items)
      },
    },
    {
      label: 'Copy',
      accelerator: '⌘C',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.copyItems(items)
      },
    },
    {
      label: 'Duplicate',
      accelerator: '⌘D',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.duplicateItems(items)
      },
    },
    separator(),
    {
      label: 'Rename',
      accelerator: 'F2',
      onClick: () => {
        selection.startRenaming(item)
      },
    },
    {
      label: 'Delete',
      accelerator: 'Delete',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.deleteItems(items)
      },
    },
  ]
}

/**
 * Get context menu items for a directory item
 */
export function getDirContextMenu(
  item: FSDirItem,
  ops: FileOperations,
  selection: FileSelectionState,
  state: AGUIAssetsExplorerState,
): AGUIContextMenuItemType[] {
  return [
    {
      label: 'Open',
      onClick: async () => {
        const list = await listFilesInDir(item, { showFiles: true })
        state.setCurDir(item)
        state.setCurFileList(list)
      },
    },
    separator(),
    {
      label: 'New File',
      onClick: () => ops.createFile(),
    },
    {
      label: 'New Folder',
      onClick: () => ops.createFolder(),
    },
    separator(),
    {
      label: 'Cut',
      accelerator: '⌘X',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.cutItems(items)
      },
    },
    {
      label: 'Copy',
      accelerator: '⌘C',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.copyItems(items)
      },
    },
    {
      label: 'Paste',
      accelerator: '⌘V',
      disabled: !selection.clipboard.value,
      onClick: () => ops.pasteItems(),
    },
    separator(),
    {
      label: 'Rename',
      accelerator: 'F2',
      onClick: () => {
        selection.startRenaming(item)
      },
    },
    {
      label: 'Delete',
      accelerator: 'Delete',
      onClick: () => {
        const items = selection.selectedItems.size > 0
          ? [...selection.selectedItems]
          : [item]
        ops.deleteItems(items)
      },
    },
  ]
}

/**
 * Get context menu items for empty area
 */
export function getEmptyAreaContextMenu(
  ops: FileOperations,
  selection: FileSelectionState,
): AGUIContextMenuItemType[] {
  return [
    {
      label: 'New File',
      onClick: () => ops.createFile(),
    },
    {
      label: 'New Folder',
      onClick: () => ops.createFolder(),
    },
    separator(),
    {
      label: 'Paste',
      accelerator: '⌘V',
      disabled: !selection.clipboard.value,
      onClick: () => ops.pasteItems(),
    },
    separator(),
    {
      label: 'Refresh',
      onClick: () => ops.refreshDir(),
    },
  ]
}
