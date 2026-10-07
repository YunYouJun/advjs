import type { DesktopWorkspaceState } from '../types/desktop'
import type { useEditorExtensions } from './useEditorExtensions'

export function useDesktopWorkspaceState(extensions: ReturnType<typeof useEditorExtensions>) {
  const app = useAppStore()
  const file = useFileStore()
  const monaco = useMonacoStore()
  const project = useProjectStore()
  const console = useConsoleStore()
  let restored = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let write = Promise.resolve()
  function capture() {
    clearTimeout(timer)
    if (!restored || !window.advDesktop || !project.projectLocation)
      return Promise.resolve(true)
    const state: DesktopWorkspaceState = JSON.parse(JSON.stringify({ version: 1, layout: app.layout, activeViews: extensions.layout.state.active, openedFile: file.openedFilePath, positions: Object.fromEntries(Object.entries(monaco.positions).slice(-200)) }))
    const pending = write.catch(() => {}).then(() => window.advDesktop!.saveWorkspaceState(state))
    write = pending
    return pending.then(() => true)
  }
  watch(() => [app.layout, extensions.layout.state.active, file.openedFilePath, monaco.positions], () => {
    if (!restored)
      return
    clearTimeout(timer)
    timer = setTimeout(() => {
      void capture().catch(error => console.error('无法保存工作区状态', { error }))
    }, 350)
  }, { deep: true })
  onBeforeUnmount(() => clearTimeout(timer))
  async function restore() {
    if (!window.advDesktop)
      return
    const state = await window.advDesktop.workspaceState()
    // Each desktop project starts with defaults, never another port's layout.
    app.resetLayout()
    extensions.resetLayout()
    monaco.positions = state.positions ?? {}
    if (state.layout)
      app.layout = state.layout
    if (state.openedFile && project.workspace) {
      try {
        const handle = await project.getLocalFileHandle(state.openedFile)
        await file.setOpenedFileHandle(handle as unknown as FileSystemFileHandle, state.openedFile)
      }
      catch (error) { console.warn('Previously opened file is unavailable', { path: state.openedFile, error }) }
    }
    // Opening a file may select its panel; apply saved selection afterwards.
    if (state.activeViews)
      extensions.layout.state.active = state.activeViews
    restored = true
  }
  return { capture, restore }
}
