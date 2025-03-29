import type { AdvData } from '@advjs/types'
// virtual module
import advData from '#advjs/data'

import chapters from '#advjs/game/chapters'
import characters from '#advjs/game/characters'
import scenes from '#advjs/game/scenes'

import { computed, readonly, shallowRef } from 'vue'

export const advDataRef = shallowRef<AdvData>(
  (import.meta.env.PROD ? advData : readonly(advData)) as AdvData,
)

// hmr
if (__DEV__) {
  if (import.meta.hot) {
    // id must be static string
    import.meta.hot!.accept('#advjs/data', (m) => {
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
  advData.gameConfig.characters = characters
  advData.gameConfig.scenes = scenes
  advData.gameConfig.chapters = chapters
  return computed(() => advDataRef.value)
}

export const advAspect = computed(() => advDataRef.value.config.aspectRatio)
export const advWidth = computed(() => advDataRef.value.config.canvasWidth)
// To honor the aspect ratio more as possible, we need to approximate the height to the next integer.
export const advHeight = computed(() => Math.ceil(advWidth.value / advAspect.value))
