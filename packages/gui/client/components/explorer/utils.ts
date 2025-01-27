import type { FSItem } from './types'
import { getFiletypeFromPath, getIconFromFileType, isImage } from '../../utils'

/**
 * get icon from fs item
 */
export async function getIconFromFSItem(item: FSItem) {
  if (item.icon)
    return item.icon

  const handle = item.handle
  if (!handle)
    return

  if (handle.kind === 'directory') {
    return 'i-vscode-icons-default-folder'
  }
  else if (handle.kind === 'file') {
    const { name = '' } = item
    if (isImage(name)) {
      // 从 handle 读取缩略图
      const file = await handle.getFile()
      const imageUrl = URL.createObjectURL(file)
      return imageUrl
    }
  }

  const name = item.name || ''
  const ext = getFiletypeFromPath(name)
  const icon = getIconFromFileType(ext)
  return icon
}
