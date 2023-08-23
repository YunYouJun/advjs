import { acceptHMRUpdate, defineStore } from 'pinia'
import type * as PIXI from 'pixi.js'

export const useAppStore = defineStore('app', () => {
  const pixiApp = shallowRef<PIXI.Application | null>(null)

  return {
    pixiApp,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
