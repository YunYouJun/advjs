import type { AdvData } from '@advjs/types'
// virtual module
import advData from '@advjs:data'

import { computed, readonly, shallowRef } from 'vue'

export const advDataRef = shallowRef<AdvData>(
  (import.meta.env.PROD ? advData : readonly(advData)) as AdvData,
)

// hmr
if (__DEV__) {
  if (import.meta.hot) {
    // id must be static string
    import.meta.hot!.accept('@advjs:data', (m) => {
      if (m) {
        advDataRef.value = m.default
      }
    })

    /**
     * 实现局部更新
     *
     * 直接 import 的配置会导致整个页面刷新
     */
    import.meta.hot?.on('advjs:update', (payload) => {
      advDataRef.value = payload.data
    })
  }
}

// init
export function initAdvData() {
  return computed(() => advDataRef.value)
}

export const advAspect = computed(() => advDataRef.value.config.aspectRatio)
export const advWidth = computed(() => advDataRef.value.config.canvasWidth)
export const advHeight = computed(() => Math.round(advWidth.value / advAspect.value))
