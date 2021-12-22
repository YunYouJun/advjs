import { acceptHMRUpdate, defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const [showUi, toggleUi] = useToggle(true)
  const [showMenu, toggleShowMenu] = useToggle(false)
  const [showHistory, toggleHistory] = useToggle(false)
  const [showBlack, toggleBlack] = useToggle(false)

  return {
    showUi,
    showHistory,
    showMenu,
    showBlack,

    toggleUi,
    toggleShowMenu,
    toggleHistory,
    toggleBlack,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
