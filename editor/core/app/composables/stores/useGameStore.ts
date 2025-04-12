import type { AdvGameConfig } from '@advjs/types'
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

  const startChapter = ref()
  const startNode = ref()

  const { $adv } = useAdvContext()
  async function loadGameFromJSONStr(jsonStr: string) {
    try {
      gameConfig.value = JSON.parse(jsonStr)
      await loadGameFromConfig(gameConfig.value)
    }
    catch (e) {
      loadStatus.value = 'fail'
      consola.error('Failed to parse game config:', e)
    }
  }

  async function loadGameFromConfig(config: AdvGameConfig) {
    gameConfig.value = config
    loadStatus.value = 'success'

    await nextTick()

    await $adv.init()
    await $adv.$nav.start('background_01')
  }

  return {
    gameConfig,
    loadStatus,

    startChapter,
    startNode,

    loadGameFromConfig,
    loadGameFromJSONStr,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
