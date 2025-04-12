import { acceptHMRUpdate, defineStore } from 'pinia'

/**
 * for runtime
 */
export const useDialogStore = defineStore('@advjs/editor:dialog', () => {
  /**
   * settings dialog is open
   */
  const settingsDialogOpen = ref(false)

  return {
    settingsDialogOpen,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDialogStore, import.meta.hot))
