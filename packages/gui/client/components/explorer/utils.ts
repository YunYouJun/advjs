import type { FSItem } from './types'
import { getFileTypeFromPath, getIconFromFileType, isImage } from '../../utils'

/**
 * get icon from fs item
 */
export async function getIconFromFSItem(item: FSItem) {
  if (item.icon)
    return item.icon

  const handle = item.handle
  if (!handle)
    return

  return getIconFromFSHandle(handle)
}

/**
 * get icon from File System handle
 */
export async function getIconFromFSHandle(fsHandle: FileSystemFileHandle | FileSystemDirectoryHandle) {
  if (fsHandle.kind === 'directory') {
    return 'i-vscode-icons-default-folder'
  }
  else if (fsHandle.kind === 'file') {
    const { name = '' } = fsHandle
    if (isImage(name)) {
      // 从 handle 读取缩略图
      const file = await fsHandle.getFile()
      const imageUrl = URL.createObjectURL(file)
      return imageUrl
    }
  }

  const name = fsHandle.name || ''
  const ext = getFileTypeFromPath(name)
  const icon = getIconFromFileType(ext)
  return icon
}
