import type { AGUILayoutType } from '@advjs/gui'
import type { Application } from 'pixi.js'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { addCustomEvent, ANALYTICS_EVENTS } from '~/utils/analystics'

const defaultLayout: AGUILayoutType = {
  name: 'root',
  type: 'vertical',
  children: [
    {
      type: 'horizontal',
      name: 'left',
      size: 78,
      children: [
        {
          type: 'vertical',
          name: 'top',
          size: 72,
          children: [
            {
              name: 'hierarchy',
              size: 25,
              min: 15,
              max: 50,
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
          size: 28,
        },
      ],
    },
    {
      name: 'right',
      size: 22,
      min: 18,
      max: 45,
    },
  ],
}

export const useAppStore = defineStore('@advjs/editor:app', () => {
  const pixiApp = shallowRef<Application | null>(null)
  const showEmptyWorkspace = shallowRef(false)
  const layout = useStorage('agui:layout', JSON.parse(JSON.stringify(defaultLayout)))

  /**
   * 当前激活的 Inspector
   */
  const activeInspector = ref<'file' | 'asset' | 'character' | 'character-create' | 'node' | 'context'>()

  return {
    layout,
    pixiApp,
    showEmptyWorkspace,

    activeInspector,

    // todo extract layout store & useAGUILayout
    resetLayout() {
      layout.value = JSON.parse(JSON.stringify(defaultLayout))
      addCustomEvent(ANALYTICS_EVENTS.RESET_LAYOUT)
    },
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAppStore, import.meta.hot))
