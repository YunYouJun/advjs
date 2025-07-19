import type { RenderTexture } from 'pixi.js'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export const useBrushStore = defineStore('brush', () => {
  const color = ref('#000000')
  const size = ref(10)

  const histories = ref<RenderTexture[]>([])

  return {
    color,
    size,

    histories,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useBrushStore, import.meta.hot))
