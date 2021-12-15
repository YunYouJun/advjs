import { acceptHMRUpdate, defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const [showUi, toggleUi] = useToggle(true)
  const [showMenu, toggleShowMenu] = useToggle(false)
  const [showHistory, toggleHistory] = useToggle(false)

  return {
    showUi,
    showHistory,
    showMenu,

    toggleUi,
    toggleShowMenu,
    toggleHistory,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
