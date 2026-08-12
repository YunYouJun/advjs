import type { AdvGameConfig } from '@advjs/types'
import { AdvGameLoadStatusEnum, useAdvContext, useGameStore as useClientGameStore } from '@advjs/client'
import { advDataRef } from '@advjs/client/compiler'
import { Toast } from '@advjs/gui'
import { useStorage } from '@vueuse/core'
import { consola } from 'consola'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { shouldFetchEditorResource } from '../../capabilities'
import { useEditorCapabilities } from '../composables/useEditorCapabilities'

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
  const capabilities = useEditorCapabilities()

  const { $adv } = useAdvContext()
  const gameConfig = computed({
    get: () => advDataRef.value.gameConfig,
    set: (value: AdvGameConfig) => {
      advDataRef.value = { ...advDataRef.value, gameConfig: value }
    },
  })
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
          ...$adv.gameConfig?.value?.bgm,
          ...config.bgm,
        },
      }

      // post
      const bgmLibrary = config.bgm.library
      const currentOrigin = globalThis.location?.origin
      if (
        typeof bgmLibrary === 'string'
        && shouldFetchEditorResource(bgmLibrary, capabilities, currentOrigin)
      ) {
        const response = await fetch(bgmLibrary)
        config.bgm.library = await response.json()
      }
    }
    catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      consola.error('Failed to adapt game config:', e)
      useConsoleStore().error('Failed to adapt game config', { error: message })
      clientGameStore.loadStatus = AdvGameLoadStatusEnum.FAIL

      Toast({
        title: 'Error Game Config Format',
        description: message,
        type: 'error',
      })

      return
    }

    gameConfig.value = config
    clientGameStore.loadStatus = AdvGameLoadStatusEnum.CONFIG_LOADED

    await $adv.init()
    clientGameStore.loadStatus = AdvGameLoadStatusEnum.SUCCESS

    if (config.chapters.length)
      await $adv.runtime.start()
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
