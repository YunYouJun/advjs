import { acceptHMRUpdate, defineStore } from 'pinia'
import { useSpeech } from './useSpeech'

export const useSettingsStore = defineStore('settings', () => {
  const fullScreen = ref(false)
  const speech = useSpeech()

  /**
   * 切换全屏
   */
  function toggleFullScreen() {
    fullScreen.value = !fullScreen.value

    if (fullScreen.value) document.documentElement.requestFullscreen()
    else document.exitFullscreen()
  }

  return {
    fullScreen,
    speech,
    toggleFullScreen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
