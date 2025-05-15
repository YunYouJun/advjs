import { acceptHMRUpdate, defineStore } from 'pinia'

/**
 * for runtime
 */
export const useDialogStore = defineStore('@advjs/editor:dialog', () => {
  /**
   * dialog open states
   */
  const openStates = ref({
    about: false,
    settings: false,
    projectSettings: false,
  })

  return {
    openStates,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDialogStore, import.meta.hot))
