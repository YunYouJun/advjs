/**
 * 检查模型格式是否为 vrm
 * @param file
 */
export function isVrmModel(file: File) {
  if (!file.name.endsWith('.vrm'))
    return false
  return true
}
