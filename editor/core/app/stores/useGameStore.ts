import type { AdvGameConfig } from '@advjs/types'
import { useAdvContext, useGameStore as useClientGameStore } from '@advjs/client'
import { AdvGameLoadStatusEnum } from '@advjs/client/constants/game.js'
import { Toast } from '@advjs/gui'
import { useStorage } from '@vueuse/core'
import { consola } from 'consola'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { gameConfig } from '../../../../packages/client/runtime'
import { DEFAULT_BGM_LIBRARY_URL } from '../constants'

/**
 * editor game store
 * for runtime
 */
export const useGameStore = defineStore('@advjs/editor:game', () => {
  const clientGameStore = useClientGameStore()

  /**
   * adapt config format
   */
  const curAdapter = useStorage<'default' | 'pominis'>('advjs:editor:adv-config-adapter', 'default')

  /**
   * todo, use client/useGameStore
   */
  const startChapter = ref()
  const startNode = ref()

  const onlineStore = useOnlineStore()
  const projectStore = useProjectStore()

  const { $adv } = useAdvContext()
  async function loadGameFromJSONStr(jsonStr: string) {
    try {
      gameConfig.value = JSON.parse(jsonStr)
      await loadGameFromConfig(gameConfig.value)
    }
    catch (e) {
      clientGameStore.loadStatus = AdvGameLoadStatusEnum.FAIL
      consola.error('Failed to parse game config:', e)
    }
  }

  async function loadGameFromConfig(config: AdvGameConfig) {
    try {
      switch (curAdapter.value) {
        case 'default':
          break
        case 'pominis':
          config = convertPominisAItoAdvConfig({
            config: config as any,
            cdnUrl: projectStore.advConfig.cdn.prefix || onlineStore.cdnUrl || onlineStore.defaultCdnUrl,
          })
          break
        default:
          break
      }

      // add default config
      config = {
        ...$adv.gameConfig.value,
        ...config,

        bgm: {
          autoplay: true,
          library: DEFAULT_BGM_LIBRARY_URL,
        },
      }

      // post
      const bgmLibrary = config.bgm.library
      if (typeof bgmLibrary === 'string') {
        fetch(bgmLibrary)
          .then(res => res.json())
          .then((data) => {
            config.bgm.library = data
          })
      }
    }
    catch (e) {
      consola.error('Failed to adapt game config:', e)
      clientGameStore.loadStatus = AdvGameLoadStatusEnum.FAIL

      Toast({
        title: 'Error Game Config Format',
        description: 'Failed to adapt game config, please check the console for more details.',
        type: 'error',
      })

      return
    }

    gameConfig.value = config
    clientGameStore.loadStatus = AdvGameLoadStatusEnum.CONFIG_LOADED

    await $adv.init()
    clientGameStore.loadStatus = AdvGameLoadStatusEnum.SUCCESS

    const startNodeId = config.chapters[0]?.nodes[0]?.id
    if (startNodeId) {
      await $adv.$nav.start({
        nodeId: startNodeId,
      })
    }
  }

  return {
    curAdapter,
    gameConfig,
    client: clientGameStore,

    startChapter,
    startNode,

    loadGameFromConfig,
    loadGameFromJSONStr,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useGameStore, import.meta.hot))
