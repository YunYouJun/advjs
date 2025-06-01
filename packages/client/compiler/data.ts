import type { AdvData } from '@advjs/types'
// virtual module
import advData from '#advjs/data'

import chapters from '#advjs/game/chapters'
import characters from '#advjs/game/characters'
import scenes from '#advjs/game/scenes'

import { defu } from 'defu'

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
  advData.gameConfig = defu(advData.gameConfig, {
    characters,
    scenes,
    chapters,
  })
  return computed(() => advDataRef.value)
}
