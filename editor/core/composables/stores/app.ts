import { acceptHMRUpdate, defineStore } from 'pinia'
import type * as PIXI from 'pixi.js'
import { useStorage } from '@vueuse/core'
import type { AGUILayoutType } from '@advjs/gui'

const defaultLayout: AGUILayoutType = {
  name: 'root',
  type: 'vertical',
  children: [
    {
      type: 'horizontal',
      name: 'left',
      size: 75,
      children: [
        {
          type: 'vertical',
          name: 'top',
          size: 64,
          children: [
            {
              name: 'hierarchy',
              size: 25,
              min: 20,
              max: 80,
            },
            {
              // main scene
              name: 'scene',
              size: 75,
            },
          ],
        },
        {
          name: 'left-bottom',
          size: 36,
        },
      ],
    },
    {
      name: 'right',
      size: 25,
      min: 20,
      max: 50,
    },
  ],
}

export const useAppStore = defineStore('app', () => {
  const pixiApp = shallowRef<PIXI.Application | null>(null)
  const layout = useStorage('agui:layout', defaultLayout)

  return {
    layout,
    pixiApp,

    // todo extract layout store & useAGUILayout
    resetLayout() {
      layout.value = defaultLayout
    },
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
