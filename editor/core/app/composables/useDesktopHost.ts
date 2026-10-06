import { useProjectDrafts } from '~/stores/useProjectDrafts'

export function useDesktopHost() {
  const drafts = useProjectDrafts()
  const fileStore = useFileStore()
  const consoleStore = useConsoleStore()
  let remove: (() => void) | undefined
  let removeGuard: (() => void) | undefined
  const router = useRouter()
  const dirty = computed(() => drafts.dirty || fileStore.isDirty)
  watch(dirty, (value) => {
    void window.advDesktop?.setDirty(value)
  })
  onMounted(() => {
    if (window.advDesktop)
      removeGuard = router.beforeEach(async (to, from) => to.path === from.path || !dirty.value || await window.advDesktop!.prepareToLeave())
    remove = window.advDesktop?.onCommand(async (command) => {
      if (command === 'reconnect')
        return await useProjectStore().connectLocalBridgeFromLaunch()
      if (command !== 'save')
        return false
      try {
        return await drafts.saveAll()
      }
      catch (error) {
        consoleStore.error('保存失败，草稿已保留', { error: String(error) })
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
