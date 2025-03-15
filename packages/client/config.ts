import type { AdvConfig, AppConfig, ThemeConfig } from '@advjs/types'
// virtual module
import advConfig from '@advjs/configs/adv'
import appConfig from '@advjs/configs/app'
import themeConfig from '@advjs/configs/theme'

import { computed, readonly, shallowRef } from 'vue'

function parse<T = any>(data: object): T {
  const parsed = data
  return (import.meta.env.DEV ? readonly(parsed) : parsed) as T
}

export const advConfigRef = shallowRef<AdvConfig>(parse<AdvConfig>(advConfig))
export const appConfigRef = shallowRef<AppConfig>(parse<AppConfig>(appConfig))
export const themeConfigRef = shallowRef<ThemeConfig>(parse<ThemeConfig>(themeConfig))

// hmr
if (__DEV__) {
  if (import.meta.hot) {
    // id must be static string
    import.meta.hot!.accept('@advjs/configs/adv', (m) => {
      advConfigRef.value = parse<AdvConfig>(m?.default)
    })
    import.meta.hot!.accept('@advjs/configs/app', (m) => {
      appConfigRef.value = parse<AppConfig>(m?.default)
    })
    import.meta.hot!.accept('@advjs/configs/theme', (m) => {
      themeConfigRef.value = parse<ThemeConfig>(m?.default)
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
