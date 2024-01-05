export interface FileItem {
  filename?: string
  name?: string
  kind?: 'file' | 'directory'
  icon?: string
  ext?: string
  handle?: FileSystemDirectoryHandle
}
