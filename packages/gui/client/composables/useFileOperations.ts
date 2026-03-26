import type { FSItem } from '../components/explorer/types'
import type { AGUIAssetsExplorerState } from './useAssetsExplorer'
import { listFilesInDir } from './useAssetsExplorer'
import { Toast } from './useToast'

/**
 * Copy a file from source handle to target directory
 */
async function copyFileHandle(
  sourceHandle: FileSystemFileHandle,
  targetDir: FileSystemDirectoryHandle,
  newName?: string,
) {
  const file = await sourceHandle.getFile()
  const targetHandle = await targetDir.getFileHandle(newName || file.name, { create: true })
  const writable = await targetHandle.createWritable()
  await writable.write(file)
  await writable.close()
  return targetHandle
}

/**
 * Copy a directory recursively from source to target
 */
async function copyDirHandle(
  sourceHandle: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
  newName?: string,
) {
  const dirHandle = await targetDir.getDirectoryHandle(newName || sourceHandle.name, { create: true })
  for await (const entry of sourceHandle.values()) {
    if (entry.kind === 'file') {
      await copyFileHandle(entry, dirHandle)
    }
    else {
      await copyDirHandle(entry, dirHandle)
    }
  }
  return dirHandle
}

/**
 * Check if a name already exists in directory
 */
async function nameExistsInDir(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name)
    return true
  }
  catch {
    try {
      await dir.getDirectoryHandle(name)
      return true
    }
    catch {
      return false
    }
  }
}

/**
 * Generate a unique name to avoid conflicts
 */
async function getUniqueName(dir: FileSystemDirectoryHandle, baseName: string, kind: 'file' | 'directory'): Promise<string> {
  if (!await nameExistsInDir(dir, baseName))
    return baseName

  if (kind === 'directory') {
    let index = 1
    let candidate = `${baseName} ${index}`
    while (await nameExistsInDir(dir, candidate)) {
      index++
      candidate = `${baseName} ${index}`
    }
    return candidate
  }

  // file: split name and ext
  const dotIndex = baseName.lastIndexOf('.')
  const nameWithoutExt = dotIndex > 0 ? baseName.slice(0, dotIndex) : baseName
  const ext = dotIndex > 0 ? baseName.slice(dotIndex) : ''

  let index = 1
  let candidate = `${nameWithoutExt} ${index}${ext}`
  while (await nameExistsInDir(dir, candidate)) {
    index++
    candidate = `${nameWithoutExt} ${index}${ext}`
  }
  return candidate
}

export function useFileOperations(state: AGUIAssetsExplorerState) {
  const { curDir, curFileList, setCurFileList, selection, rootDir } = state

  async function refreshDir() {
    const dir = curDir.value
    if (!dir)
      return
    const list = await listFilesInDir(dir, { showFiles: true })
    setCurFileList(list)
  }

  async function renameItem(item: FSItem, newName: string) {
    if (!item.handle || !item.parent?.handle)
      return false
    if (item.name === newName)
      return false

    const parentHandle = item.parent.handle

    // Check if name already exists
    if (await nameExistsInDir(parentHandle, newName)) {
      Toast({ title: 'Error', description: `"${newName}" already exists`, type: 'error' })
      return false
    }

    // Callback check
    if (state.onRename) {
      const result = await state.onRename(item, newName)
      if (result === false)
        return false
    }

    try {
      if (item.kind === 'file' && item.handle) {
        await copyFileHandle(item.handle as FileSystemFileHandle, parentHandle, newName)
        await parentHandle.removeEntry(item.name)
      }
      else if (item.kind === 'directory' && item.handle) {
        await copyDirHandle(item.handle as FileSystemDirectoryHandle, parentHandle, newName)
        await parentHandle.removeEntry(item.name, { recursive: true })
      }
      await refreshDir()
      return true
    }
    catch (e) {
      console.error('Rename failed:', e)
      Toast({ title: 'Rename Failed', description: String(e), type: 'error' })
      return false
    }
  }

  async function deleteItems(items: FSItem[]) {
    if (items.length === 0)
      return false

    // Prevent deleting root
    for (const item of items) {
      if (item === rootDir.value) {
        Toast({ title: 'Error', description: 'Cannot delete root directory', type: 'error' })
        return false
      }
    }

    // Callback check
    if (state.onDelete) {
      const result = await state.onDelete(items)
      if (result === false)
        return false
    }

    // eslint-disable-next-line no-alert
    const confirmed = confirm(
      items.length === 1
        ? `Delete "${items[0].name}"?`
        : `Delete ${items.length} items?`,
    )
    if (!confirmed)
      return false

    try {
      for (const item of items) {
        if (!item.parent?.handle)
          continue
        await item.parent.handle.removeEntry(item.name, { recursive: true })
      }
      selection.clearSelection()
      await refreshDir()
      return true
    }
    catch (e) {
      console.error('Delete failed:', e)
      Toast({ title: 'Delete Failed', description: String(e), type: 'error' })
      return false
    }
  }

  async function createFolder(name?: string) {
    const dir = curDir.value
    if (!dir?.handle)
      return

    const folderName = name || 'New Folder'

    // Callback check
    if (state.onCreate) {
      const result = await state.onCreate(dir, folderName, 'directory')
      if (result === false)
        return
    }

    try {
      const uniqueName = await getUniqueName(dir.handle, folderName, 'directory')
      await dir.handle.getDirectoryHandle(uniqueName, { create: true })
      await refreshDir()

      // Find the newly created item and start renaming
      const newItem = curFileList.value.find(i => i.name === uniqueName)
      if (newItem) {
        selection.select(newItem)
        selection.startRenaming(newItem)
      }
    }
    catch (e) {
      console.error('Create folder failed:', e)
      Toast({ title: 'Create Folder Failed', description: String(e), type: 'error' })
    }
  }

  async function createFile(name?: string) {
    const dir = curDir.value
    if (!dir?.handle)
      return

    const fileName = name || 'New File.txt'

    // Callback check
    if (state.onCreate) {
      const result = await state.onCreate(dir, fileName, 'file')
      if (result === false)
        return
    }

    try {
      const uniqueName = await getUniqueName(dir.handle, fileName, 'file')
      await dir.handle.getFileHandle(uniqueName, { create: true })
      await refreshDir()

      // Find the newly created item and start renaming
      const newItem = curFileList.value.find(i => i.name === uniqueName)
      if (newItem) {
        selection.select(newItem)
        selection.startRenaming(newItem)
      }
    }
    catch (e) {
      console.error('Create file failed:', e)
      Toast({ title: 'Create File Failed', description: String(e), type: 'error' })
    }
  }

  function copyItems(items: FSItem[]) {
    selection.setClipboard(items, 'copy')
  }

  function cutItems(items: FSItem[]) {
    selection.setClipboard(items, 'cut')
  }

  async function pasteItems() {
    const dir = curDir.value
    if (!dir?.handle || !selection.clipboard.value)
      return

    const { items, mode } = selection.clipboard.value

    try {
      for (const item of items) {
        if (!item.handle)
          continue

        const uniqueName = await getUniqueName(dir.handle, item.name, item.kind || 'file')

        if (item.kind === 'file') {
          await copyFileHandle(item.handle as FileSystemFileHandle, dir.handle, uniqueName)
        }
        else if (item.kind === 'directory') {
          await copyDirHandle(item.handle as FileSystemDirectoryHandle, dir.handle, uniqueName)
        }

        // For cut mode, delete the source
        if (mode === 'cut' && item.parent?.handle) {
          await item.parent.handle.removeEntry(item.name, { recursive: true })
        }
      }

      if (mode === 'cut')
        selection.clearClipboard()

      await refreshDir()
    }
    catch (e) {
      console.error('Paste failed:', e)
      Toast({ title: 'Paste Failed', description: String(e), type: 'error' })
    }
  }

  async function duplicateItems(items: FSItem[]) {
    const dir = curDir.value
    if (!dir?.handle)
      return

    try {
      for (const item of items) {
        if (!item.handle)
          continue

        const uniqueName = await getUniqueName(dir.handle, item.name, item.kind || 'file')

        if (item.kind === 'file') {
          await copyFileHandle(item.handle as FileSystemFileHandle, dir.handle, uniqueName)
        }
        else if (item.kind === 'directory') {
          await copyDirHandle(item.handle as FileSystemDirectoryHandle, dir.handle, uniqueName)
        }
      }
      await refreshDir()
    }
    catch (e) {
      console.error('Duplicate failed:', e)
      Toast({ title: 'Duplicate Failed', description: String(e), type: 'error' })
    }
  }

  return {
    refreshDir,
    renameItem,
    deleteItems,
    createFolder,
    createFile,
    copyItems,
    cutItems,
    pasteItems,
    duplicateItems,
  }
}

export type FileOperations = ReturnType<typeof useFileOperations>
