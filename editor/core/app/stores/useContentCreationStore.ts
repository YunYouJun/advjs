import type { ContentCreationKind } from '../utils/content-creation'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { contentCreationPlan } from '../utils/content-creation'
import { useProjectDrafts } from './useProjectDrafts'

interface ContentCreationDraft {
  kind: ContentCreationKind
  id: string
  title: string
  /** A completed write can be reopened without submitting it a second time. */
  createdPath?: string
}

/** One authoring dialog shared by core commands and the editor menu. */
export const useContentCreationStore = defineStore('@advjs/editor:content-creation', () => {
  const project = useProjectStore()
  const file = useFileStore()
  const drafts = useProjectDrafts()
  const draft = ref<ContentCreationDraft>()
  const busy = shallowRef(false)
  const error = shallowRef('')
  let sequence = 0
  const available = computed(() => Boolean(
    project.workspace?.writeFiles && !project.isRestoringProject
    && project.project?.mode === 'standard-markdown'
    && project.project.compilation.project.format === 'adv-md',
  ))

  watch(() => project.workspace, () => {
    sequence++
    draft.value = undefined
    error.value = ''
    busy.value = false
  }, { flush: 'sync' })

  function begin(kind: ContentCreationKind, locale: string) {
    if (!available.value || busy.value || draft.value)
      return
    const zh = locale === 'zh-CN'
    const title = kind === 'world' ? (zh ? '世界观' : 'World') : kind === 'chapter' ? (zh ? '新章节' : 'New chapter') : (zh ? '新场景' : 'New scene')
    let id = ''
    if (kind !== 'world') {
      const model = project.project!
      const ids = new Set((kind === 'chapter' ? model.compilation.project.chapters : model.compilation.project.scenes).map(item => item.id.toLowerCase()))
      const paths = new Set(Object.keys(model.files).map(path => path.toLowerCase()))
      const directory = `${model.compilation.project.root}/${kind === 'chapter' ? 'chapters' : 'scenes'}`
      let index = 1
      do {
        id = `${kind}-${String(index++).padStart(2, '0')}`
      } while (ids.has(id) || paths.has(`${directory}/${id}${kind === 'chapter' ? '.adv.md' : '.md'}`.toLowerCase()))
    }
    error.value = ''
    draft.value = { kind, id, title }
  }

  function cancel() {
    if (busy.value)
      return
    sequence++
    draft.value = undefined
    error.value = ''
  }

  async function create(locale: string) {
    const input = draft.value
    const workspace = project.workspace
    if (!input || !workspace || !project.project || busy.value)
      return false
    if (!available.value) {
      error.value = locale === 'zh-CN' ? '项目正在恢复或不支持内容创建，请等待恢复完成或打开标准 Markdown 项目。' : 'Wait for project recovery or open a standard Markdown project before creating content.'
      return false
    }
    const request = ++sequence
    const current = () => request === sequence && project.workspace === workspace && draft.value === input
    busy.value = true
    error.value = ''
    function assertCanOpen() {
      if (file.isDirty || file.loading || drafts.dirty)
        throw new Error(locale === 'zh-CN' ? '请先保存或放弃当前文件的修改和其他表单草稿，并等待文件加载完成。' : 'Save or discard the current file and other form drafts, and wait for the file to finish loading.')
    }
    try {
      assertCanOpen()
      const plan = input.createdPath
        ? { path: input.createdPath, changes: [] }
        : contentCreationPlan(project.project, { ...input, locale })
      if (plan.changes.length) {
        await project.writeProjectFiles(plan.changes)
        if (!current())
          return false
        input.createdPath = plan.path
      }
      const handle = await project.getLocalFileHandle(plan.path)
      if (!current())
        return false
      assertCanOpen()
      await file.setOpenedFileHandle(handle as unknown as FileSystemFileHandle, plan.path)
      if (current())
        assertCanOpen()
      return current() && file.openedFilePath === plan.path
    }
    catch (cause) {
      if (current())
        error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (current())
        busy.value = false
    }
    return false
  }

  return { draft, busy, error, available, begin, cancel, create }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useContentCreationStore, import.meta.hot))
