import type { AdvConfig } from '@advjs/types'
// @ts-expect-error missing types
import _configs from '/@advjs/configs'
import { computed, shallowRef } from 'vue'

export const advConfigRef = shallowRef<AdvConfig>(_configs)
export const config = _configs as AdvConfig

// hmr
if (__DEV__) {
  if (import.meta.hot) {
    import.meta.hot.accept('/@advjs/configs', (m) => {
      advConfigRef.value = m?.default
    })

    import.meta.hot?.on('advjs:update', (payload) => {
      advConfigRef.value = payload.data.config
      Object.assign(config, payload.data.config)
    })
  }
}

export function initConfig() {
  return computed(() => advConfigRef.value)
}

export const configs = _configs as AdvConfig

export const advAspect = configs.aspectRatio
export const advWidth = configs.canvasWidth
export const advHeight = Math.round(advWidth / advAspect)
