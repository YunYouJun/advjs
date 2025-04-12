import type { AdvGameConfig } from '@advjs/types'
import type { PominisAIVSConfig } from '../../utils'
import { useAdvContext } from '@advjs/client'
import { Toast } from '@advjs/gui'
import { useStorage } from '@vueuse/core'
import { consola } from 'consola'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { gameConfig } from '../../../../../packages/client/runtime'

/**
 * editor game store
 * for runtime
 */
export const useGameStore = defineStore('editor:game', () => {
  /**
   * adapt config format
   */
  const curAdapter = useStorage<'default' | 'pominis'>('advjs:editor:adv-config-adapter', 'default')
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
    try {
      switch (curAdapter.value) {
        case 'default':
          break
        case 'pominis':
          config = convertPominisAItoAdvConfig(config as any as PominisAIVSConfig)
          break
        default:
          break
      }
    }
    catch (e) {
      consola.error('Failed to adapt game config:', e)
      loadStatus.value = 'fail'

      Toast({
        title: 'Error Game Config Format',
        description: 'Failed to adapt game config, please check the console for more details.',
        type: 'error',
      })

      return
    }

    gameConfig.value = config
    loadStatus.value = 'success'

    await nextTick()

    await $adv.init()

    const startNodeId = config.chapters[0]?.nodes[0]?.id
    if (startNodeId) {
      await $adv.$nav.start(startNodeId)
    }
  }

  return {
    curAdapter,
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
