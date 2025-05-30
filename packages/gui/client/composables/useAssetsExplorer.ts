import type { InjectionKey, Ref } from 'vue'
import type { AGUIBreadcrumbItem } from '../components/breadcrumb/types'
import type { AGUIAssetsExplorerProps, FSDirItem, FSItem } from '../components/explorer/types'
import type { TreeNode } from '../components/tree/types'
import { computed, inject } from 'vue'
import { sortFSItems } from '../utils'

export interface AGUIAssetsExplorerState extends Omit<AGUIAssetsExplorerProps, 'rootDir' | 'curDir' | 'curFileList' | 'tree'> {
  rootDir: Ref<FSDirItem | undefined>
  curDir: Ref<FSDirItem | undefined>
  curFileList: Ref<FSItem[]>
  tree: Ref<TreeNode>

  // ctx
  emit: (event: 'update:curDir' | 'update:rootDir' | 'update:tree', value: FSDirItem) => void
    | ((event: 'update:curFileList', value: FSItem[]) => void)

  setCurDir: (dir: FSDirItem) => void
  setCurFileList: (list: FSItem[]) => void
  setRootDir: (dir: FSDirItem) => void
}

export const AGUIAssetsExplorerSymbol: InjectionKey<AGUIAssetsExplorerState> = Symbol('AGUIAssetsExplorer')

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

  return sortFSItems(files)
}

export async function openRootDir(dirHandle: FileSystemDirectoryHandle, state: AGUIAssetsExplorerState) {
  const { curFileList, tree, setCurFileList, setCurDir, setRootDir } = state
  const dir = getDirItemFromHandle(dirHandle)
  if (!dir)
    return

  setCurDir(dir)
  setRootDir(dir)

  const list = await listFilesInDir(dir, {
    showFiles: true,
  })
  setCurFileList(list)

  tree.value = {
    name: dir.name,
    handle: dir.handle,
    children: curFileList.value,
    expanded: true,
  }
}

/**
 * get breadcrumb items from curDir
 */
export function getBreadcrumbItems(state: ReturnType<typeof useAGUIAssetsExplorerState>) {
  const { curDir, setCurDir, setCurFileList } = state
  let tempDir = curDir.value
  const items: AGUIBreadcrumbItem[] = []
  while (tempDir) {
    const dir = tempDir
    items.unshift({
      label: dir.name || '',
      onClick: async () => {
        setCurDir(dir)
        setCurFileList(await listFilesInDir(dir, {
          showFiles: true,
        }))
      },
    })
    tempDir = tempDir.parent
  }
  return items
}

export function useAGUIAssetsExplorer(state: AGUIAssetsExplorerState) {
  const breadcrumbItems = computed(() => getBreadcrumbItems(state))

  return {
    breadcrumbItems,
  }
}

/**
 * click icon to open root dir
 */
export async function onOpenDir(dirHandle: FileSystemDirectoryHandle, state: AGUIAssetsExplorerState) {
  if (!state.beforeOpenRootDir || await state.beforeOpenRootDir(dirHandle)) {
    // emit before set curDir to before open-directory component unmount
    await openRootDir(dirHandle, state)
    const { rootDir } = state
    if (rootDir.value)
      state.onOpenRootDir?.(rootDir.value)
  }
}

/**
 * open dir with picker
 */
export async function openDir(state: AGUIAssetsExplorerState) {
  try {
    const dirHandle = await window.showDirectoryPicker()
    await onOpenDir(dirHandle, state)
  }
  catch (e) {
    // user abort
    console.error(e)
  }
}
