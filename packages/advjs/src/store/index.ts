import { createStore } from 'vuex';
import settings from './modules/settings';

const state = () => ({
  showUi: true,
  showHistory: false,
});

const mutations = {
  toggleHistory(state: any) {
    state.toggleHistory = !state.showHistory;
  },
  toggleUi(state: any) {
    state.showUi = !state.showUi;
  },
};

const store = createStore({
  state,
  mutations,
  actions: {},
  modules: {
    settings,
  },
});

export default store;
