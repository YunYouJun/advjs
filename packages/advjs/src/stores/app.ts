import { acceptHMRUpdate, defineStore } from 'pinia'

export const useAppStore = defineStore('app', () => {
  const [showUi, toggleUi] = useToggle(true)
  // 加载菜单
  const [showLoadMenu, toggleShowLoadMenu] = useToggle(false)
  const [showMenu, toggleShowMenu] = useToggle(false)

  const [showHistory, toggleHistory] = useToggle(false)
  const [showBlack, toggleBlack] = useToggle(false)
  const [showTachie, toggleTachie] = useToggle(true)

  return {
    showUi,
    showHistory,
    showMenu,
    showLoadMenu,
    showBlack,
    showTachie,

    toggleUi,
    toggleShowMenu,
    toggleShowLoadMenu,
    toggleHistory,
    toggleBlack,
    toggleTachie,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
