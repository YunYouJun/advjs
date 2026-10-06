import { useProjectDrafts } from '~/stores/useProjectDrafts'

export function useDesktopHost(options: { resetLayout: () => void, manageExtensions: () => void }) {
  const drafts = useProjectDrafts()
  const fileStore = useFileStore()
  const consoleStore = useConsoleStore()
  let remove: (() => void) | undefined
  let removeGuard: (() => void) | undefined
  const router = useRouter()
  const dialogs = useDialogStore()
  const app = useAppStore()
  const dirty = computed(() => drafts.dirty || fileStore.isDirty)
  watch(dirty, (value) => {
    void window.advDesktop?.setDirty(value)
  })
  onMounted(() => {
    if (window.advDesktop)
      removeGuard = router.beforeEach(async (to, from) => to.path === from.path || !dirty.value || await window.advDesktop!.prepareToLeave())
    remove = window.advDesktop?.onCommand(async (command) => {
      try {
        const host = window.advDesktop!
        switch (command) {
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
            await router.push('/')
            break
          case 'extensions':
            await router.push('/')
            options.manageExtensions()
            break
          case 'reset-layout':
            app.resetLayout()
            options.resetLayout()
            break
          case 'preview':
            await host.preview()
            break
          case 'stop-preview':
            await host.stopPreview()
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
    void window.advDesktop?.setDirty(dirty.value)
  })
  onBeforeUnmount(() => {
    remove?.()
    removeGuard?.()
  })
}
