import type { TreeNode } from '../../components/tree/types'

export interface FSBaseItem {
  name: string
  kind?: 'file' | 'directory'
  icon?: string
  ext?: string
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
  parent?: FSDirItem
  onDblClick?: (item: FSItem) => void | Promise<void>
}

export interface FSFileItem extends FSBaseItem {
  kind: 'file'
  file?: File
  handle?: FileSystemFileHandle
}

export interface FSDirItem extends FSBaseItem {
  kind: 'directory'
  handle: FileSystemDirectoryHandle
  children?: FSItem[]
}

export type FSItem = FSFileItem | FSDirItem

/**
 * props
 */
export interface AGUIAssetsExplorerProps {
  /**
   * init folder
   */
  rootDir?: FSDirItem
  curDir?: FSDirItem
  /**
   * current file list
   */
  curFileList?: FSItem[]
  tree?: TreeNode

  // dir
  /**
   * before open root dir
   *
   * return false to prevent open
   */
  beforeOpenRootDir?: (dirHandle: FileSystemDirectoryHandle) => boolean | Promise<boolean>
  /**
   * when open root dir
   */
  onOpenRootDir?: (dir: FSDirItem) => void | Promise<void>

  // file
  onFileDrop?: (files: FSFileItem[]) => (FSFileItem[] | Promise<FSFileItem[]>)
  onDblClick?: (item: FSItem) => void | Promise<void>
  /**
   * click file in file list
   *
   * 和 dblClick 一起的时候，好像有问题
   */
  onFileClick?: (item: FSFileItem) => void | Promise<void>
  /**
   * dblclick file in file list
   */
  onFileDblClick?: (item: FSFileItem) => void | Promise<void>
  /**
   * dblclick dir in file list
   */
  onDirDblClick?: (item: FSDirItem) => void | Promise<void>
  /**
   * on FileItem change
   * every fs item change
   */
  onFSItemChange?: (item: FSItem) => void | Promise<void>
}
