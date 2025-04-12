import { getIconFromFSHandle } from '@advjs/gui/client/components/explorer/utils.js'

/**
 * get file info from file handle
 */
export function useInspectorFileHandle(fileHandle?: FileSystemFileHandle) {
  if (!fileHandle)
    return

  const icon = ref()
  const content = ref()

  watchEffect(async () => {
    const file = await fileHandle?.getFile()

    const text = await file?.text()
    content.value = text

    // gameStore.gameConfig

    if (fileHandle) {
      icon.value = await getIconFromFSHandle(fileHandle)
    }
  })

  const language = computed(() => {
    const ext = fileHandle?.name.split('.').pop()
    return ext === 'js' ? 'javascript' : ext
  })

  return {
    name: computed(() => fileHandle?.name),
    icon,
    content,
    language,
  }
}
