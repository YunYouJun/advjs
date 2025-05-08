import { acceptHMRUpdate, defineStore } from 'pinia'
import { useStartMenu } from '../composables'
import { name } from '../package.json'

export const useThemeDefaultStore = defineStore(name, () => {
  const $startMenu = useStartMenu()

  return {
    $startMenu,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useThemeDefaultStore, import.meta.hot))
