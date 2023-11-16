import { acceptHMRUpdate, defineStore } from 'pinia'
import { shallowRef } from 'vue'
import type { setup } from '../setup'

type BabylonSetupReturn = Awaited<ReturnType<typeof setup>>

// https://doc.babylonjs.com/extensions/Babylon.js+ExternalLibraries/BabylonJS_and_Vue/BabylonJS_and_Vue_1#vue-reflectivity-friend-or-foe
export const useBabylonStore = defineStore('babylon', () => {
  // should not child reactive
  const instance = shallowRef<BabylonSetupReturn>()

  function setInstance(babylon: BabylonSetupReturn) {
    instance.value = babylon
  }

  return {
    instance,

    setInstance,

  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useBabylonStore, import.meta.hot))
