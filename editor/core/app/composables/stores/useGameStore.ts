import { useAdvContext } from '@advjs/client'
import { consola } from 'consola'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { gameConfig } from '../../../../../packages/client/runtime'

/**
 * editor game store
 * for runtime
 */
export const useGameStore = defineStore('editor:game', () => {
  /**
   * Load game from JSON file
   */
  const loadStatus = ref<'' | 'success' | 'fail'>('')

  const { $adv } = useAdvContext()
  async function loadGameFromJSONStr(jsonStr: string) {
    try {
      gameConfig.value = JSON.parse(jsonStr)
      loadStatus.value = 'success'

      await nextTick()

      await $adv.init()
      await $adv.$nav.start('background_01')
    }
    catch (e) {
      loadStatus.value = 'fail'
      consola.error('Failed to parse game config:', e)
    }
  }

  return {
    gameConfig,
    loadStatus,

    loadGameFromJSONStr,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
