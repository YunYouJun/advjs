import type { ComputedRef } from 'vue'
import type { DefaultTheme } from '../types'
import { themeConfigSymbol } from '@advjs/core'
import { computed, inject } from 'vue'

/**
 * get theme default config
 */
export function useThemeConfig<ThemeConfig = DefaultTheme.Config>() {
  const config = inject<ComputedRef<ThemeConfig>>(themeConfigSymbol)
  if (!config) {
    console.warn('[@advjs/theme-default]', 'theme config not found, use default config.')
    return computed(() => {})
  }
  return config!
}
