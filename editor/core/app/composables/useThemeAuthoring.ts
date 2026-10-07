import type { ThemeSourceId } from '../utils/theme-authoring'
import { computed, ref, watch } from 'vue'
import { useEditorLayoutState } from '../extensions/layout-state'
import { resolveThemeSources, themeAiContext, themeOverrideChanges } from '../utils/theme-authoring'

export function useThemeAuthoring() {
  const project = useProjectStore()
  const file = useFileStore()
  const layout = useEditorLayoutState()
  const { locale } = useEditorLocale()
  const zh = computed(() => locale.value === 'zh-CN')
  const bundle = computed(() => resolveThemeSources(project.project?.files ?? {}, project.advConfig.theme))
  const selected = ref<ThemeSourceId>('start')
  const source = computed(() => bundle.value.sources.find(source => source.id === selected.value)!)
  const request = ref('')
  const busy = ref(false)
  const error = ref('')
  const { copyReport } = useEditorErrorReport()
  const copied = ref(false)
  watch(request, () => copied.value = false)
  watch(() => project.workspace, () => {
    selected.value = 'start'
    request.value = ''
    error.value = ''
    copied.value = false
  })

  async function edit() {
    error.value = ''
    busy.value = true
    try {
      if (file.isDirty)
        throw new Error(zh.value ? '请先保存或放弃当前文件的修改，再编辑主题。' : 'Save or discard the current file before editing the theme.')
      const workspace = project.workspace
      const target = source.value
      if (target.content === undefined)
        throw new Error(zh.value ? '当前主题没有可用的内置源码，请先添加项目覆盖文件。' : 'This theme has no bundled source. Add a project override first.')
      const changes = themeOverrideChanges(bundle.value, selected.value)
      if (changes.length)
        await project.writeProjectFiles(changes)
      if (workspace !== project.workspace)
        return false
      const handle = await project.getLocalFileHandle(target.path)
      if (workspace !== project.workspace)
        return false
      await file.setOpenedFileHandle(handle as unknown as FileSystemFileHandle, target.path)
      if (file.openedFilePath !== target.path)
        return false
      layout.select('main', 'advjs.core/file')
      return true
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
    finally { busy.value = false }
    return false
  }

  async function copyForAi() {
    error.value = ''
    try {
      await copyReport(themeAiContext(bundle.value, request.value, zh.value))
      copied.value = true
    }
    catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  }

  return { bundle, selected, source, request, busy, error, copied, edit, copyForAi }
}
