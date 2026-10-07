import type { ProjectTemplateMeta } from '../templates'
import { PROJECT_TEMPLATE_LIST } from '../templates'

interface CreationDraft { template: ProjectTemplateMeta, name: string, folderName: string, directory: string }

/** One creation dialog per editor window, shared by welcome and native menus. */
export function useDesktopProjectCreation() {
  const draft = useState<CreationDraft | undefined>('desktop:creation-draft')
  const busy = useState('desktop:creation-busy', () => false)
  const error = useState('desktop:creation-error', () => '')
  const { locale } = useI18n()

  async function begin(templateId: string) {
    if (busy.value || draft.value)
      return
    const host = window.advDesktop
    const template = PROJECT_TEMPLATE_LIST.find(item => item.meta.id === templateId)?.meta
    if (!host || !template)
      return
    busy.value = true
    error.value = ''
    try {
      const defaults = await host.projectCreationDefaults(templateId)
      draft.value = { template, name: locale.value === 'zh-CN' ? template.name : template.nameEn ?? template.name, ...defaults }
    }
    catch (cause) {
      useConsoleStore().error('无法准备新建项目', { error: cause })
    }
    finally {
      busy.value = false
    }
  }
  function cancel() {
    if (!busy.value)
      draft.value = undefined
  }
  async function browse() {
    if (!draft.value || busy.value)
      return
    busy.value = true
    error.value = ''
    try {
      const directory = await window.advDesktop!.selectProjectCreationDirectory()
      if (directory && draft.value)
        draft.value.directory = directory
    }
    catch (cause) {
      error.value = String(cause)
    }
    finally {
      busy.value = false
    }
  }
  async function create() {
    if (!draft.value || busy.value)
      return
    busy.value = true
    error.value = ''
    try {
      const input = draft.value
      const result = await window.advDesktop!.createProject(input.template.id, { name: input.name, folderName: input.folderName })
      if (result.created)
        draft.value = undefined
      else
        error.value = result.error ?? (locale.value === 'zh-CN' ? '项目未创建或未打开，请检查通知后重试。' : 'The project was not created or opened. Check the notification and try again.')
    }
    catch (cause) {
      error.value = String(cause)
    }
    finally {
      busy.value = false
    }
  }
  return { draft, busy, error, begin, cancel, browse, create }
}
