import type { InjectionKey, Ref } from 'vue'
import { inject, ref } from 'vue'
import { sortFSItems } from '../utils'
import type { FSDirItem, FSItem } from '../components/explorer/types'
import type { AGUIBreadcrumbItem } from '../components/breadcrumb/types'
import type { TreeNode } from '../components/tree/types'

export const rootDir = ref<FSDirItem>()
export const curDir = ref<FSDirItem>()
export const curFileList = ref<FSItem[]>([])
export const tree = ref()

export const AGUIAssetsExplorerSymbol: InjectionKey<{
  rootDir: Ref<FSDirItem | undefined>
  curDir: Ref<FSDirItem | undefined>
  curFileList: Ref<FSItem[]>
  tree: Ref<TreeNode>

  onDblClick?: (item: FSItem) => void | Promise<void>
}> = Symbol('AGUIAssetsExplorer')

export function useAGUIAssetsExplorerState() {
  const state = inject(AGUIAssetsExplorerSymbol)
  if (!state)
    throw new Error('AGUIAssetsExplorerSymbol not provided')
  return state
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
  const files: FSItem[] = []
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

export async function openRootDir(dirHandle: FileSystemDirectoryHandle) {
  // const { curDir, curFileList, rootDir, tree } = useAGUIAssetsExplorerState()
  const dir = getDirItemFromHandle(dirHandle)
  if (!dir)
    return
  curDir.value = dir
  rootDir.value = dir

  const list = await listFilesInDir(dir, {
    showFiles: true,
  })

  curFileList.value = sortFSItems(list)
  tree.value = {
    name: dir.name,
    handle: dir.handle,
    children: curFileList,
    expanded: true,
  }
}

/**
 * click icon to open root dir
 */
export async function onOpenDir() {
  try {
    const dirHandle = await window.showDirectoryPicker()
    await openRootDir(dirHandle)
  }
  catch (e) {
    // user abort
    console.error(e)
  }
}

/**
 * get breadcrumb items from curDir
 */
export function getBreadcrumbItems(curDir: Ref<FSDirItem | undefined>, curFileList: Ref<FSItem[]>) {
  let tempDir = curDir.value
  const items: AGUIBreadcrumbItem[] = []
  while (tempDir) {
    const dir = tempDir
    items.unshift({
      label: dir.name || '',
      onClick: async () => {
        curDir.value = dir
        curFileList.value = await listFilesInDir(dir, {
          showFiles: true,
        })
      },
    })
    tempDir = tempDir.parent
  }
  return items
}
