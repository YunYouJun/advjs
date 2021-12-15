import { acceptHMRUpdate, defineStore } from 'pinia'
import { useSpeech } from './useSpeech'
import { namespace } from '~/utils'

export const useSettingsStore = defineStore('settings', () => {
  const speech = useSpeech()
  const { isFullscreen, toggle: toggleFullScreen } = useFullscreen()

  // to be deprecated, because import prebuild
  const advMdUrl = useStorage(`${namespace}-md-url`, '/md/test.adv.md')

  return {
    isFullscreen,
    advMdUrl,

    speech,
    toggleFullScreen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
