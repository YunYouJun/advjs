import { acceptHMRUpdate, defineStore } from 'pinia'
import { useStartMenu } from '../composables'

export const useThemeDefaultStore = defineStore('theme-default', () => {
  const { startMenuItems } = useStartMenu()

  return {
    startMenuItems,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useThemeDefaultStore, import.meta.hot))
