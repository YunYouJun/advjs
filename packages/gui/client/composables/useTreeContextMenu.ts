import type { AGUIContextMenuItemType } from '../components/context-menu/types'
import type { FSDirItem, FSItem } from '../components/explorer/types'
import type { TreeNode } from '../components/tree/types'
import type { AGUIAssetsExplorerState } from './useAssetsExplorer'
import type { FileOperations } from './useFileOperations'
import type { FileSelectionState } from './useFileSelection'
import { listFilesInDir } from './useAssetsExplorer'

function separator(): AGUIContextMenuItemType {
  return { type: 'separator' }
}

/**
 * Get context menu items for a tree node.
 *
 * - Directory nodes: Open, New File, New Folder, Rename, Delete
 * - File nodes: Open, Rename, Delete
 */
export function getTreeNodeContextMenu(
  node: TreeNode,
  ops: FileOperations,
  selection: FileSelectionState,
  state: AGUIAssetsExplorerState,
): AGUIContextMenuItemType[] {
  const item = node as unknown as FSItem
  const isDirectory = item.kind === 'directory' || node.handle?.kind === 'directory'

  if (isDirectory) {
    return [
      {
        label: 'Open',
        onClick: async () => {
          node.expanded = true
          const dirItem = item as FSDirItem
          const list = await listFilesInDir(dirItem, { showFiles: true })
          state.setCurDir(dirItem)
          state.setCurFileList(list)
        },
      },
      separator(),
      {
        label: 'New File',
        onClick: async () => {
          // Navigate to dir first, then create
          const dirItem = item as FSDirItem
          const list = await listFilesInDir(dirItem, { showFiles: true })
          state.setCurDir(dirItem)
          state.setCurFileList(list)
          ops.createFile()
        },
      },
      {
        label: 'New Folder',
        onClick: async () => {
          const dirItem = item as FSDirItem
          const list = await listFilesInDir(dirItem, { showFiles: true })
          state.setCurDir(dirItem)
          state.setCurFileList(list)
          ops.createFolder()
        },
      },
      separator(),
      {
        label: 'Rename',
        onClick: () => {
          selection.startRenaming(item)
        },
      },
      {
        label: 'Delete',
        onClick: () => {
          ops.deleteItems([item])
        },
      },
    ]
  }

  // File node
  return [
    {
      label: 'Open',
      onClick: () => {
        if (state.onFileDblClick) {
          state.onFileDblClick(item)
        }
      },
    },
    separator(),
    {
      label: 'Rename',
      onClick: () => {
        selection.startRenaming(item)
      },
    },
    {
      label: 'Delete',
      onClick: () => {
        ops.deleteItems([item])
      },
    },
  ]
}
