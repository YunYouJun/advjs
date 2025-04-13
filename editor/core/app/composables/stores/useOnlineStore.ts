import { useStorage } from '@vueuse/core'

/**
 * online json mode
 */
export const useOnlineStore = defineStore('editor:online', () => {
  /**
   * confirmed online adv config file
   */
  const onlineAdvConfigFileUrl = useStorage('adv:editor:online-adv-config-url', '')
  /**
   * cdn url
   */
  const cdnUrl = useStorage('advjs:editor:cdn-url', '')
  const defaultCdnUrl = computed(() => {
    return onlineAdvConfigFileUrl.value.split('/').slice(0, -1).join('/')
  })

  return {
    onlineAdvConfigFileUrl,

    cdnUrl,
    defaultCdnUrl,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useOnlineStore, import.meta.hot))
