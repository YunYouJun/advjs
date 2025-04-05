import { acceptHMRUpdate, defineStore } from 'pinia'
import { gameConfig } from '../../../../../packages/client/runtime'

/**
 * editor game store
 * for runtime
 */
export const useGameStore = defineStore('editor:game', () => {
  return {
    gameConfig,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
