import { acceptHMRUpdate, defineStore } from 'pinia'
import type * as PIXI from 'pixi.js'

export const useBrushStore = defineStore('brush', () => {
  const color = ref('#000000')
  const size = ref(10)

  const histories = ref<PIXI.RenderTexture[]>([])

  return {
    color,
    size,

    histories,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useBrushStore, import.meta.hot))
