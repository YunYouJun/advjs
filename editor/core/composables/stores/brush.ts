import { acceptHMRUpdate, defineStore } from 'pinia'

export const useBrushStore = defineStore('brush', () => {
  const size = ref(10)

  return {
    size,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useBrushStore, import.meta.hot))
