import { ref } from 'vue'
import type { Trees } from '..'
import type { FileItem } from '../components/explorer/types'

export const curDirHandle = ref<FileSystemDirectoryHandle>()
export const vscodeFolderIcon = 'i-vscode-icons-default-folder'
export const curFileList = ref<FileItem[]>([])
export const tree = ref()

export async function listFilesInDirectory(dirHandle: FileSystemDirectoryHandle, options: {
  showFiles?: boolean
}) {
  const files: Trees = []
  for await (const entry of dirHandle.values()) {
    // exclude
    if (entry.name.startsWith('.'))
      continue

    if (entry.kind === 'directory') {
      files.push({
        name: entry.name,
        kind: entry.kind,
        handle: entry,
        children: await listFilesInDirectory(entry, options),
      })
    }

    // ignore file
    if (options.showFiles) {
      if (entry.kind === 'file') {
        files.push({
          name: entry.name,
          kind: entry.kind,
          handle: entry,
        })
      }
    }
  }

  return files
}

/**
 * set assets dir handle
 */
export async function setAssetsDirHandle(dirHandle: FileSystemDirectoryHandle) {
  const fileList = []

  curFileList.value = await listFilesInDirectory(dirHandle, {
    showFiles: false,
  })
  fileList.push(...curFileList.value)

  tree.value = {
    name: dirHandle.name,
    handle: dirHandle,
    children: fileList,
    expanded: true,
  }
}

export async function onOpenDir() {
  try {
    const dirHandle = await window.showDirectoryPicker()
    setAssetsDirHandle(dirHandle)
    curDirHandle.value = dirHandle
  }
  catch (e) {
    // user abort
    console.error(e)
  }
}
