import speechSynthesis from './speechSynthesis';

const state = () => ({
  fullScreen: false,
});

const mutations = {
  toggleFullScreen(state: any) {
    state.fullScreen = !state.fullScreen;
    if (state.fullScreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  },
};

export default {
  namespaced: true,
  state,
  mutations,
  modules: {
    speechSynthesis,
  },
};
