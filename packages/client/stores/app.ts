import { ns } from '@advjs/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { useStorage, useToggle } from '@vueuse/core'
import { useSound } from '@vueuse/sound'
import { useAdvCtx } from '~/setup'

export const useAppStore = defineStore('app', () => {
  const $adv = useAdvCtx()
  const curBgm = useSound($adv.config.bgm?.collection[0].src)

  const [showUi, toggleUi] = useToggle(true)
  // 加载菜单
  const [showMenu, toggleShowMenu] = useToggle(false)
  // 加载存档菜单
  const [showLoadMenu, toggleShowLoadMenu] = useToggle(false)
  // 存储存档菜单
  const [showSaveMenu, toggleShowSaveMenu] = useToggle(false)

  const [showHistory, toggleHistory] = useToggle(false)
  const [showBlack, toggleBlack] = useToggle(false)
  const [showTachie, toggleTachie] = useToggle(true)

  const [showBg, toggleBg] = useToggle(true)

  // toggle background music
  const toggleBgm = () => {
    curBgm.isPlaying.value ? curBgm.pause() : curBgm.play()
  }

  // 3D canvas flag
  const showCanvas = useStorage(ns('canvas'), false)
  const toggleCanvas = useToggle(showCanvas)

  return {
    showUi,
    showHistory,
    showMenu,
    showSaveMenu,
    showLoadMenu,
    showBlack,
    showTachie,
    showCanvas,
    showBg,

    curBgm,
    toggleBgm,

    toggleUi,
    toggleShowMenu,
    toggleShowSaveMenu,
    toggleShowLoadMenu,
    toggleHistory,
    toggleBlack,
    toggleTachie,
    toggleCanvas,
    toggleBg,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
