import { acceptHMRUpdate, defineStore } from 'pinia';

export const useAppStore = defineStore('app', () => {
  const showUi = ref(true);
  const showHistory = ref(false);

  function toggleUi() {
    showUi.value = !showUi.value;
  }

  function toggleHistory() {
    showHistory.value = !showHistory.value;
  }

  return {
    showUi,
    showHistory,

    toggleUi,
    toggleHistory,
  };
});

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot));
