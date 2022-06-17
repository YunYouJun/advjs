import { acceptHMRUpdate, defineStore } from 'pinia'
import { ns } from '@advjs/core'
import { useFullscreen, useStorage } from '@vueuse/core'
import type { Ref } from 'vue'
import { useSpeech } from './useSpeech'

import type { SettingOptions } from './types'

export * from './types'

export const useSettingsStore = defineStore('settings', () => {
  // userClientConfig
  const { toggle: toggleFullScreen } = useFullscreen()

  const getDefaultSettings = () => {
    const defaultSettings: SettingOptions = {
      isFullscreen: false,
      text: {
        curSpeed: 'fast',
        curFontSize: 'xl',
        curDisplayMode: 'soft',
      },
      play: {
        mdUrl: '/md/test.adv.md',
      },
      speech: {
        enable: true,
        language: 'zh-HK',
      },
      animation: {
        duration: 1000,
      },
    }
    return defaultSettings
  }

  const userClientSettings = useStorage(ns('settings'), getDefaultSettings())

  const resetSettings = () => {
    userClientSettings.value = getDefaultSettings()
  }

  return {
    storage: userClientSettings,

    resetSettings,

    speech: useSpeech(userClientSettings as Ref<SettingOptions>),
    toggleFullScreen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
