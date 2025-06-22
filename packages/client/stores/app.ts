import { ns } from '@advjs/core'
import { useStorage, useToggle } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAppStore = defineStore('@advjs/client/app', () => {
  const [showUi, toggleUi] = useToggle(true)
  // 加载存档菜单
  const [showLoadMenu, toggleShowLoadMenu] = useToggle(false)
  // 存储存档菜单
  const [showSaveMenu, toggleShowSaveMenu] = useToggle(false)

  /**
   * 菜单状态
   */
  const menus = ref({
    /**
     * 设置
     */
    settings: false,
  })

  const [showHistory, toggleHistory] = useToggle(false)
  const [showBlack, toggleBlack] = useToggle(false)
  const [showTachie, toggleTachie] = useToggle(true)

  const [showBg, toggleBg] = useToggle(true)

  /**
   * show dialog controls
   */
  const showDialogControls = useStorage(ns('dialog-controls'), false)

  // 3D canvas flag
  const showCanvas = useStorage(ns('canvas'), false)
  const toggleCanvas = useToggle(showCanvas)

  const transition = ref(false)
  const rotation = ref(0)
  const rotate = () => {
    transition.value = true
    rotation.value = rotation.value + 90
    setTimeout(() => {
      transition.value = false
    }, 300)
  }
  const isHorizontal = computed(() => rotation.value % 180 === 0)

  return {
    transition,
    rotation,
    isHorizontal,
    rotate,

    showUi,
    showHistory,
    showSaveMenu,
    showLoadMenu,
    showBlack,
    showTachie,
    showCanvas,
    showBg,

    showDialogControls,

    menus,

    toggleUi,
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
