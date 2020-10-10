interface SpeechSynthesis {
  enable: boolean;
  language: string;
}

const state = () => ({
  enable: true,
  language: 'zh-HK',
});

const mutations = {
  /**
   * 切换语音合成开关
   * @param state
   */
  toggleStatus(state: SpeechSynthesis) {
    state.enable = !state.enable;
  },
  /**
   * 选择语言
   * @param state
   * @param language
   */
  setLanguage(state: SpeechSynthesis, language: string) {
    state.language = language;
  },
};

export default {
  namespaced: true,
  state,
  mutations,
};
