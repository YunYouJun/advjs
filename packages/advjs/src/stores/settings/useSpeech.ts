import { namespace } from '@advjs/shared/utils'

interface SpeechSynthesis {
  enable: boolean
  language: string
}

export const useSpeech = (
  options: SpeechSynthesis = {
    enable: true,
    language: 'zh-HK',
  },
) => {
  const state = useStorage<SpeechSynthesis>(`${namespace}-speech-options`, options || {
    enable: true,
    language: 'zh-HK',
  })

  /**
   * 切换语音合成开关
   */
  const toggleStatus = () => {
    state.value.enable = !state.value.enable
  }

  /**
   * 选择语言
   * @param state
   * @param language
   */
  function setLanguage(language: string) {
    state.value.language = language
  }

  return {
    options: state,

    toggleStatus,
    setLanguage,
  }
}
