import type { AdvConfig, AppConfig, ThemeConfig } from '@advjs/types'

import { computed, readonly, shallowRef } from 'vue'
import advConfig from '#advjs:adv.config'
import appConfig from '#advjs:app.config'
import themeConfig from '#advjs:theme.config'

function parse<T = any>(data: string): T {
  const parsed = JSON.parse(data)
  return (import.meta.env.DEV ? readonly(parsed) : parsed) as T
}

export const advConfigRef = shallowRef<AdvConfig>(parse<AdvConfig>(advConfig))
export const appConfigRef = shallowRef<AppConfig>(parse<AppConfig>(appConfig))
export const themeConfigRef = shallowRef<ThemeConfig>(parse<ThemeConfig>(themeConfig))

// hmr
if (__DEV__) {
  if (import.meta.hot) {
    const configs = ['#advjs:adv.config', '#advjs:app.config', '#advjs:theme.config']
    configs.forEach((id) => {
      import.meta.hot!.accept(id, (m) => {
        if (id === '#advjs:adv.config')
          advConfigRef.value = parse<AdvConfig>(m?.default)
        if (id === '#advjs:app.config')
          appConfigRef.value = parse<AppConfig>(m?.default)
        if (id === '#advjs:theme.config')
          themeConfigRef.value = parse<ThemeConfig>(m?.default)
      })
    })

    import.meta.hot?.on('advjs:update', (payload) => {
      advConfigRef.value = parse<AdvConfig>(payload.data.config)
    })
  }
}

// init
export function initAdvConfig() {
  return computed(() => advConfigRef.value)
}
export function initAppConfig() {
  return computed(() => appConfigRef.value)
}
export function initThemeConfig() {
  return computed(() => themeConfig)
}

export const advAspect = computed(() => advConfigRef.value.aspectRatio)
export const advWidth = computed(() => advConfigRef.value.canvasWidth)
export const advHeight = computed(() => Math.round(advWidth.value / advAspect.value))
