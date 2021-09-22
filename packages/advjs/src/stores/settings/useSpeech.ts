interface SpeechSynthesis {
  enable: boolean;
  language: string;
}

export const useSpeech = (
  options: SpeechSynthesis = {
    enable: true,
    language: 'zh-HK',
  }
) => {
  const state = reactive(options);

  /**
   * 切换语音合成开关
   * @param state
   */
  function toggleStatus() {
    state.enable = !state.enable;
  }

  /**
   * 选择语言
   * @param state
   * @param language
   */
  function setLanguage(language: string) {
    state.language = language;
  }

  return {
    options: state,
    toggleStatus,
    setLanguage,
  };
};
