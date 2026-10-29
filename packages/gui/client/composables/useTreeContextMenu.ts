import type { AGUIContextMenuItemType } from '../components/context-menu/types'
import type { FSDirItem, FSItem } from '../components/explorer/types'
import type { TreeNode } from '../components/tree/types'
import type { AGUIAssetsExplorerState } from './useAssetsExplorer'
import type { FileOperations } from './useFileOperations'
import type { FileSelectionState } from './useFileSelection'
import { nextTick } from 'vue'
import { listFilesInDir } from './useAssetsExplorer'
import { Toast } from './useToast'

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
  const menuRoot = state.rootDir.value
  const canRename = Boolean(menuRoot && item.handle && item.parent?.handle)

  // The tree and listing contain different item instances. Show the actual
  // parent and edit its freshly read item, retaining the host's rename writer.
  async function renameInParent() {
    const parent = item.parent
    const root = menuRoot
    const currentDir = state.curDir.value
    if (!root || !parent?.handle || !item.handle || state.rootDir.value !== root)
      return
    try {
      if (!await root.handle.resolve(parent.handle))
        throw new Error('Item is outside the current project')
      const list = await listFilesInDir(parent, { showFiles: true })
      const current = list.find(candidate => candidate.name === item.name && candidate.kind === item.kind)
      if (!current?.handle || !await current.handle.isSameEntry(item.handle))
        throw new Error('The original item is no longer available')
      if (state.rootDir.value !== root || state.curDir.value !== currentDir)
        return
      state.setCurDir(parent)
      state.setCurFileList(list)
      const opened = state.curDir.value
      await nextTick()
      if (state.rootDir.value !== root || state.curDir.value !== opened)
        return
      selection.select(current)
      selection.startRenaming(current)
    }
    catch {
      Toast({ title: 'Rename Unavailable', description: 'The item or project changed. Choose it again.', type: 'warning' })
    }
  }

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
        disabled: !canRename,
        onClick: renameInParent,
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
      disabled: !canRename,
      onClick: renameInParent,
    },
    {
      label: 'Delete',
      onClick: () => {
        ops.deleteItems([item])
      },
    },
  ]
}
