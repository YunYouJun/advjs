import type { ComputedRef } from 'vue'
import type { ThemeConfig } from '../types'
import { themeConfigSymbol } from '@advjs/core'
import { inject } from 'vue'

/**
 * get theme default config
 */
export function useThemeConfig<T = ThemeConfig>() {
  const config = inject<ComputedRef<T>>(themeConfigSymbol)
  if (!config) {
    throw new Error('[ADV.JS] theme config not properly injected in client.')
  }
  return config!
}
