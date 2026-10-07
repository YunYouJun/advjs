import { useProjectDrafts } from '~/stores/useProjectDrafts'
import { useDesktopStore } from '../stores/useDesktopStore'

export function useDesktopHost(options: { resetLayout: () => void, manageExtensions: () => void, captureState: () => Promise<boolean>, selectGame: () => void }) {
  const drafts = useProjectDrafts()
  const fileStore = useFileStore()
  const consoleStore = useConsoleStore()
  const desktop = useDesktopStore()
  const project = useProjectStore()
  const { locale } = useI18n()
  let removeEvents: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false
  let lastTask = ''
  let lastPreviewError = ''
  let remove: (() => void) | undefined
  let removeGuard: (() => void) | undefined
  const router = useRouter()
  const dialogs = useDialogStore()
  const creation = useDesktopProjectCreation()
  const preview = useDesktopPreview()
  const app = useAppStore()
  const dirty = computed(() => drafts.dirty || fileStore.isDirty)
  watch(dirty, (value) => {
    void window.advDesktop?.setDirty(value).catch(error => consoleStore.warn('Desktop dirty state unavailable', { error }))
  })
  onMounted(() => {
    if (window.advDesktop)
      removeGuard = router.beforeEach(async (to, from) => to.path === from.path || !dirty.value || await window.advDesktop!.prepareToLeave())
    remove = window.advDesktop?.onCommand(async (command) => {
      try {
        const host = window.advDesktop!
        switch (command) {
          case 'capture-state':
            return await options.captureState()
          case 'project-switcher':
            desktop.switcherOpen = true
            break
          case 'reconnect':
            return await useProjectStore().connectLocalBridgeFromLaunch()
          case 'save':
            return await drafts.saveAll()
          case 'preferences':
            dialogs.openStates.preferences = true
            break
          case 'project-settings':
            dialogs.openStates.projectSettings = true
            break
          case 'about':
            dialogs.openStates.about = true
            break
          case 'codex-workflow':
            dialogs.openStates.codexWorkflow = true
            break
          case 'characters':
            await router.push('/characters')
            break
          case 'workspace':
            app.showEmptyWorkspace = true
            await router.push('/')
            break
          case 'welcome':
            app.showEmptyWorkspace = false
            await router.push('/')
            break
          case 'extensions':
            app.showEmptyWorkspace = true
            await router.push('/')
            options.manageExtensions()
            break
          case 'reset-layout':
            app.showEmptyWorkspace = true
            app.resetLayout()
            options.resetLayout()
            break
          case 'preview':
          case 'preview-window':
          case 'preview-build':
            await router.push('/')
            app.showEmptyWorkspace = true
            options.selectGame()
            if (command === 'preview-build')
              await preview.start(preview.mode.value, 'build')
            else if (preview.active.value)
              await preview.present(command === 'preview' ? 'embedded' : 'window')
            else
              await preview.start(command === 'preview' ? 'embedded' : 'window')
            break
          case 'stop-preview':
            await preview.stop()
            break
          case 'export-directory':
            await host.exportGame('directory')
            break
          case 'export-zip':
            await host.exportGame('zip')
            break
          default:
            return false
        }
        return true
      }
      catch (error) {
        consoleStore.error(command === 'save' ? '保存失败，草稿已保留' : '桌面菜单操作失败', { error: String(error) })
        return false
      }
    })
    const host = window.advDesktop
    if (host) {
      const notice = (item: { title: string, message: string, report: string }) => consoleStore.error(item.title, { error: item.message, report: item.report })
      removeEvents = host.onEvent((event) => {
        if (event.type === 'error') {
          notice(event.notice)
        }
        else if (event.type === 'create-project') {
          void creation.begin(event.templateId)
        }
        else if (event.type === 'preview-in-editor') {
          void router.push('/').then(() => options.selectGame())
        }
        else {
          void desktop.refreshProjects()
          void project.loadDesktopRecentProjects().catch(error => consoleStore.warn('Recent projects unavailable', { error }))
        }
      })
      void host.ready().then(items => items.forEach(notice)).catch(error => consoleStore.warn('Desktop notifications unavailable', { error }))
      void desktop.refreshProjects()
      const poll = async () => {
        try {
          const status = await host.status()
          if (disposed)
            return
          desktop.status = status
          const task = status.task
          const identity = task ? `${task.id}:${task.state}` : ''
          if (task && task.kind !== 'live' && identity !== lastTask && task.state === 'failed')
            consoleStore.error(locale.value === 'zh-CN' ? '构建失败' : 'Build failed', { error: task.error, logs: task.logs, kind: task.kind, output: task.output })
          const previewError = status.preview?.error ?? (task?.kind === 'live' && task.state === 'failed' ? task.error : '') ?? ''
          if (previewError && previewError !== lastPreviewError)
            consoleStore.error(locale.value === 'zh-CN' ? '实时预览失败' : 'Live preview failed', { error: previewError, logs: task?.logs })
          lastPreviewError = previewError
          lastTask = identity
        }
        catch (error) {
          if (!disposed)
            consoleStore.warn('Desktop status unavailable', { error })
        }
        finally {
          if (!disposed)
            timer = setTimeout(poll, 500)
        }
      }
      void poll()
    }
    void window.advDesktop?.setDirty(dirty.value).catch(error => consoleStore.warn('Desktop dirty state unavailable', { error }))
  })
  onBeforeUnmount(() => {
    disposed = true
    clearTimeout(timer)
    removeEvents?.()
    remove?.()
    removeGuard?.()
  })
}
