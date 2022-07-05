import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const leftOrder = ref(0)
  const rightOrder = ref(1)

  const isPositive = computed(() => leftOrder.value < rightOrder.value)

  function toggleLeftRight() {
    [leftOrder.value, rightOrder.value] = [rightOrder.value, leftOrder.value]
  }

  return {
    leftOrder,
    rightOrder,

    isPositive,

    toggleLeftRight,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
