import { acceptHMRUpdate, defineStore } from 'pinia'
import { useSpeech } from './useSpeech'

export const useSettingsStore = defineStore('settings', () => {
  const speech = useSpeech()
  const { isFullscreen, toggle } = useFullscreen()

  return {
    isFullscreen,

    speech,
    toggleFullScreen: toggle,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
