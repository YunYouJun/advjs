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
   * autocomplete options
   */
  const onlineAdvConfigUrlOptions = useStorage<string[]>('advjs:editor:online-adv-config-url:options', [])

  /**
   * cdn url
   */
  const cdnUrl = useStorage('advjs:editor:cdn-url', '')
  const defaultCdnUrl = computed(() => {
    return onlineAdvConfigFileUrl.value.split('/').slice(0, -1).join('/')
  })

  function addConfigUrlOption(url: string) {
    if (!onlineAdvConfigUrlOptions.value.includes(url)) {
      onlineAdvConfigUrlOptions.value.push(url)
    }
  }

  return {
    onlineAdvConfigFileUrl,
    onlineAdvConfigUrlOptions,
    addConfigUrlOption,

    cdnUrl,
    defaultCdnUrl,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useOnlineStore, import.meta.hot))
