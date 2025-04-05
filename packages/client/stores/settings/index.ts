import type { SettingOptions } from './types'
import { ns } from '@advjs/core'
import { useFullscreen, useSpeechSynthesis, useStorage } from '@vueuse/core'

import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export * from './types'

export const useSettingsStore = defineStore('settings', () => {
  // userClientConfig
  const { toggle: toggleFullScreen } = useFullscreen()

  const getDefaultSettings = () => {
    const defaultSettings: SettingOptions = {
      text: {
        curSpeed: 'fast',
        curFontSize: '3xl',
        curDisplayMode: 'soft',
      },
      play: {
        mdUrl: '/md/test.adv.md',
      },
      speech: false,
      speechOptions: {
        lang: 'zh-HK',
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

  const speechContent = ref('大家好，我是渣渣辉！')

  return {
    storage: userClientSettings,

    resetSettings,

    speechContent,
    speech: useSpeechSynthesis(speechContent, userClientSettings.value.speechOptions),
    toggleFullScreen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useSettingsStore, import.meta.hot))
