import type * as BABYLON from 'babylonjs'

import { acceptHMRUpdate, defineStore } from 'pinia'

export const useBabylonStore = defineStore('babylon', () => {
  const activeScene = ref<BABYLON.Scene>()

  function setScene(scene: BABYLON.Scene) {
    activeScene.value = scene
  }

  return {
    activeScene,

    setScene,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useBabylonStore, import.meta.hot))
