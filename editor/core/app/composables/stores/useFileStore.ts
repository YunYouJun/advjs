import type { FSFileItem } from '@advjs/gui/runtime'
import { acceptHMRUpdate, defineStore } from 'pinia'

export const useFileStore = defineStore('file', () => {
  /**
   * 被打开的文件
   *
   * 一次只有一个
   */
  const openedFile = shallowRef<FSFileItem>()

  return {
    openedFile,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFileStore, import.meta.hot))
