import { acceptHMRUpdate, defineStore } from 'pinia'

export const useThemeStarterStore = defineStore('theme-starter', () => {
  return {

  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useThemeStarterStore, import.meta.hot))
