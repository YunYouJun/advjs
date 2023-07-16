import { acceptHMRUpdate, defineStore } from 'pinia'
import type * as BABYLON from '@babylonjs/core'

import { computed, shallowRef } from 'vue'

import type { AsyncReturnType } from '@advjs/shared/types'
import type { VRMManager } from 'babylon-vrm-loader'
import type { setup } from '../setup'

type SetupBabylonReturnType = AsyncReturnType<typeof setup>

export const useVrmStore = defineStore('vrm', () => {
  const babylon = shallowRef<{
    engine: BABYLON.Engine
    scene: BABYLON.Scene
  }>()
  const engine = computed(() => babylon.value?.engine)
  const scene = computed(() => babylon.value?.scene)
  const vrmManager = shallowRef<VRMManager>()

  const setBabylon = (val: SetupBabylonReturnType) => {
    babylon.value = val
  }

  const setVrmManager = (val: VRMManager | undefined) => {
    vrmManager.value = val
  }

  return {
    babylon,
    engine,
    scene,
    vrmManager,

    setBabylon,
    setVrmManager,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useVrmStore, import.meta.hot))
