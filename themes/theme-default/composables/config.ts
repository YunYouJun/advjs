import type { ComputedRef } from 'vue'
import type { DefaultTheme } from '../types'
import { themeConfigSymbol } from '@advjs/core'
import { inject } from 'vue'

/**
 * get theme default config
 */
export function useThemeConfig<ThemeConfig = DefaultTheme.Config>() {
  const config = inject<ComputedRef<ThemeConfig>>(themeConfigSymbol)
  if (!config) {
    throw new Error('[ADV.JS] theme config not properly injected in client.')
  }
  return config!
}
