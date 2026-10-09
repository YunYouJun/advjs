import type { WatchHandle } from 'vue'
import type { ProjectSourcePosition, SourceEditorBinding } from '../stores/useMonacoStore'
import { onScopeDispose, readonly, shallowRef, watch } from 'vue'
import { useEditorLayoutState } from '../extensions/layout-state'
import { useProjectDrafts } from '../stores/useProjectDrafts'

/** Open saved project source without replacing an unsaved editor draft. */
export function useProjectSourceNavigation() {
  const project = useProjectStore()
  const file = useFileStore()
  const monaco = useMonacoStore()
  const drafts = useProjectDrafts()
  const layout = useEditorLayoutState()
  const { locale } = useEditorLocale()
  const busy = shallowRef(false)
  const error = shallowRef('')
  let sequence = 0
  let active = true
  let cancelWait: (() => void) | undefined
  const message = (zh: string, en: string) => locale.value === 'zh-CN' ? zh : en

  function invalidate() {
    sequence++
    cancelWait?.()
    busy.value = false
    error.value = ''
  }
  watch(() => [project.workspace, project.isRestoringProject], invalidate, { flush: 'sync' })
  onScopeDispose(() => {
    active = false
    invalidate()
  })

  function assertClean() {
    // Positions belong to the saved compilation. Even a dirty draft in the
    // same file may have moved the target; do not present that line as reliable.
    if (file.isDirty || drafts.dirty)
      throw new Error(message('请先保存或放弃未保存的修改，再定位已保存的源码。', 'Save or discard unsaved changes before locating saved source.'))
  }

  function waitForEditor(path: string, isCurrent: () => boolean) {
    return new Promise<SourceEditorBinding | undefined>((resolve) => {
      let stop: WatchHandle | undefined
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      let cancel: (() => void) | undefined
      const finish = (binding?: SourceEditorBinding) => {
        if (settled)
          return
        settled = true
        clearTimeout(timer)
        stop?.()
        if (cancelWait === cancel)
          cancelWait = undefined
        resolve(binding)
      }
      cancel = () => finish()
      timer = setTimeout(cancel, 5000)
      cancelWait = cancel
      let hadEditor = false
      stop = watch(() => ({
        binding: monaco.sourceEditor,
        ready: monaco.sourceEditor?.canNavigate(path),
        current: isCurrent() && file.openedFilePath === path && layout.state.active.main === 'advjs.core/file',
      }), ({ binding, ready, current }) => {
        if (!current || (!binding && hadEditor))
          finish()
        else if (binding && ready)
          finish(binding)
        hadEditor ||= Boolean(binding)
      }, { immediate: true, flush: 'sync' })
      if (settled)
        stop()
    })
  }

  async function navigate(source: ProjectSourcePosition): Promise<boolean> {
    if (!active || busy.value)
      return false
    const request = ++sequence
    const workspace = project.workspace
    const isCurrent = () => active && request === sequence && workspace === project.workspace
    busy.value = true
    error.value = ''
    try {
      if (!workspace || project.isRestoringProject)
        throw new Error(message('请先打开可用的项目。', 'Open an available project first.'))
      assertClean()
      if (file.loading)
        throw new Error(message('文件正在加载，请稍后重试。', 'A file is loading. Try again shortly.'))
      if (!source.path || source.path.startsWith('/') || source.path.includes('\\') || source.path.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part)))
        throw new Error(message('源码路径无效。', 'Invalid project source path.'))
      if ([source.line, source.column].some(value => value !== undefined && (!Number.isInteger(value) || value < 1)))
        throw new Error(message('源码位置无效。', 'Invalid source position.'))
      const savedSource = project.project?.files[source.path]
      if (savedSource === undefined)
        throw new Error(message('项目中找不到此源码，请刷新流程图后重试。', 'Source is missing from this project. Refresh the flow graph and try again.'))
      const sourceIsCurrent = () => monaco.fileContent === savedSource && project.project?.files[source.path] === savedSource
      const assertCurrentSource = () => {
        if (!sourceIsCurrent())
          throw new Error(message('源码已发生变化，请刷新流程图后重新定位。', 'Source has changed. Refresh the flow graph before locating it again.'))
      }
      const handle = await project.getLocalFileHandle(source.path)
      if (!isCurrent())
        return false
      assertClean()
      await file.setOpenedFileHandle(handle as unknown as FileSystemFileHandle, source.path, { forceReload: true })
      if (!isCurrent() || file.openedFilePath !== source.path)
        return false
      assertClean()
      assertCurrentSource()
      layout.select('main', 'advjs.core/file')
      const binding = await waitForEditor(source.path, isCurrent)
      const viewIsCurrent = () => isCurrent() && file.openedFilePath === source.path && layout.state.active.main === 'advjs.core/file'
      if (!viewIsCurrent())
        return false
      assertClean()
      assertCurrentSource()
      if (!binding || !await binding.navigate(source, () => viewIsCurrent() && sourceIsCurrent() && !file.isDirty && !drafts.dirty)) {
        if (!viewIsCurrent())
          return false
        assertClean()
        assertCurrentSource()
        throw new Error(message('源码编辑器尚未就绪，请重试定位。', 'The source editor is not ready. Try locating the source again.'))
      }
      return true
    }
    catch (cause) {
      if (isCurrent())
        error.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
    finally {
      if (isCurrent())
        busy.value = false
    }
  }

  return { navigate, busy: readonly(busy), error: readonly(error) }
}
