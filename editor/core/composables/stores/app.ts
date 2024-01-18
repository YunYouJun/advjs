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
          name: 'project',
          size: 36,
        },
      ],
    },
    {
      name: 'right',
      size: 25,
      min: 20,
      max: 60,
    },
  ],
}

export const useAppStore = defineStore('app', () => {
  const pixiApp = shallowRef<PIXI.Application | null>(null)
  const layout = useStorage('agui:layout', JSON.parse(JSON.stringify(defaultLayout)))

  return {
    layout,
    pixiApp,

    // todo extract layout store & useAGUILayout
    resetLayout() {
      layout.value = JSON.parse(JSON.stringify(defaultLayout))
    },
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
