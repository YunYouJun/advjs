import { Toast } from '@advjs/gui'
import { parseCharacterMd } from '@advjs/parser'

export function useProjectFileActions() {
  const project = useProjectStore()
  const file = useFileStore()
  const characters = useCharacterStore()
  const app = useAppStore()
  const { locale } = useEditorLocale()

  async function open(path: string) {
    try {
      const workspace = project.workspace
      const handle = await project.getLocalFileHandle(path)
      if (project.workspace !== workspace)
        return
      await file.setOpenedFileHandle(handle as unknown as FileSystemFileHandle, path)
      if (file.openedFilePath !== path || project.workspace !== workspace)
        return
      if (path.endsWith('.character.md')) {
        characters.selectedCharacter = parseCharacterMd(useMonacoStore().fileContent)
        characters.selectedCharacterHandle = handle as unknown as FileSystemFileHandle
        app.activeInspector = 'character'
      }
    }
    catch (error) {
      Toast({
        title: locale.value === 'zh-CN' ? '无法打开文件' : 'Could not open file',
        description: file.isDirty && locale.value === 'zh-CN' ? '请先保存或放弃当前文件的修改，再打开其他文件。' : error instanceof Error ? error.message : String(error),
        type: 'error',
      })
    }
  }

  return { open }
}
