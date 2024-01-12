export interface FSBaseItem {
  name: string
  kind?: 'file' | 'directory'
  icon?: string
  ext?: string
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
  parent?: FSDirItem
}

export interface FSFileItem extends FSBaseItem {
  kind: 'file'
  file?: File
  handle: FileSystemFileHandle
}

export interface FSDirItem extends FSBaseItem {
  kind: 'directory'
  handle: FileSystemDirectoryHandle
  children?: FSItem[]
}

export type FSItem = FSFileItem | FSDirItem
