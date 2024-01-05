import { ref } from 'vue'
import type { Trees } from '../..'
import type { FileItem } from './types'

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

  curFileList.value = files
  return files
}

export async function onOpenDir() {
  const fileList = []
  try {
    const dirHandle = await window.showDirectoryPicker()

    // directory handle 转换为树结构
    // console.log(dir.entries())
    fileList.push(...await listFilesInDirectory(dirHandle, {
      showFiles: false,
    }))
    tree.value = {
      name: dirHandle.name,
      handle: dirHandle,
      children: fileList,
      expanded: true,
    }
  }
  catch (e) {
    // user abort
    console.error(e)
  }
}
