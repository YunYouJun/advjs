import { ref } from 'vue'
import type { Trees } from '..'
import type { FSBaseItem, FSDirItem } from '../components/explorer/types'

export const rootDir = ref<FSDirItem>()
export const curDir = ref<FSDirItem>()
export const vscodeFolderIcon = 'i-vscode-icons-default-folder'
export const curFileList = ref<FSBaseItem[]>([])
export const tree = ref()

export function getExplorerState() {
  return {
    rootDir,
    curDir,
    curFileList,
    tree,
  }
}

/**
 * set cur dir item by handle
 */
export function getDirItemFromHandle(handle: FileSystemDirectoryHandle): FSDirItem {
  return {
    name: handle.name,
    kind: 'directory',
    handle,
  }
}

/**
 * save file to dir handle
 */
export async function saveFile(file: File, dirHandle?: FileSystemDirectoryHandle) {
  dirHandle = dirHandle || curDir.value?.handle
  if (!dirHandle)
    return

  // create a new handle
  const newFileHandle = await dirHandle.getFileHandle(file.name, { create: true })
  if (!newFileHandle)
    return

  // create a FileSystemWritableFileStream to write to
  const writableStream = await newFileHandle.createWritable()

  // write our file
  await writableStream.write(file)

  // close the file and write the contents to disk.
  await writableStream.close()
  return newFileHandle
}

/**
 * show files in dir
 */
export async function listFilesInDir(dir: FSDirItem, options: {
  showFiles?: boolean
}) {
  const files: Trees = []
  const dirHandle = dir.handle
  for await (const entry of dirHandle.values()) {
    // exclude
    if (entry.name.startsWith('.'))
      continue

    if (entry.kind === 'directory') {
      files.push({
        name: entry.name,
        kind: entry.kind,
        handle: entry,
        children: await listFilesInDir({
          name: entry.name,
          kind: entry.kind,
          handle: entry,
          parent: dir,
        }, options),
        parent: dir,
      })
    }

    // ignore file
    if (options.showFiles) {
      if (entry.kind === 'file') {
        files.push({
          name: entry.name,
          kind: entry.kind,
          handle: entry,
          parent: dir,
        })
      }
    }
  }

  return files
}

/**
 * set dir as assets dir
 */
export async function setAssetsDir(dir: FSDirItem) {
  const fileList = []

  curFileList.value = await listFilesInDir(dir, {
    showFiles: false,
  })
  fileList.push(...curFileList.value)

  tree.value = {
    name: dir.name,
    handle: dir.handle,
    children: fileList,
    expanded: true,
  }
}

/**
 * click icon to open root dir
 */
export async function onOpenDir() {
  try {
    const dirHandle = await window.showDirectoryPicker()
    curDir.value = getDirItemFromHandle(dirHandle)
    rootDir.value = curDir.value
    setAssetsDir(rootDir.value)

    const dir = rootDir.value
    const list = await listFilesInDir(dir, {
      showFiles: true,
    })
    curFileList.value = list
  }
  catch (e) {
    // user abort
    console.error(e)
  }
}
