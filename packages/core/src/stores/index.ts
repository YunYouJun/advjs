import { acceptHMRUpdate, defineStore } from 'pinia'

export const useAdvStore = defineStore('adv', () => {
  return {

  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAdvStore, import.meta.hot))
