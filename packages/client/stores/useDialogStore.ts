import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export const useDialogStore = defineStore('@advjs/client/stores/dialog', () => {
  // 局部 words order，与全局 order 相区别
  const iOrder = ref(0)

  return {
    iOrder,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useDialogStore, import.meta.hot))
