import type { Ref } from 'vue'
import type { SettingOptions } from './types'

export interface SpeechSynthesisOptions {
  enable: boolean
  language: string
}

export const useSpeech = (
  settings: Ref<SettingOptions>,
) => {
  /**
   * 切换语音合成开关
   */
  const toggleStatus = () => {
    settings.value.speech.enable = !settings.value.speech.enable
  }

  /**
   * 选择语言
   * @param state
   * @param language
   */
  function setLanguage(language: string) {
    settings.value.speech.language = language
  }

  return {
    toggleStatus,
    setLanguage,
  }
}
