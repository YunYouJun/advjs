import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useAudioStore = defineStore('editor:audio', () => {
  /**
   * 背景音乐库地址
   */
  const bgmLibraryUrl = useStorage('ae:bgm-library-url', '')
  const bgmLibraryData = useStorage<Record<string, { name: string, description: string }>>('ae:bgm-library-data', {})

  return {
    bgmLibraryUrl,
    bgmLibraryData,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAudioStore, import.meta.hot))
