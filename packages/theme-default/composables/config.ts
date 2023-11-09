import { themeConfigSymbol } from '@advjs/client/constants'
import type { ComputedRef } from 'vue'
import { computed, inject } from 'vue'
import type { DefaultTheme } from '../types'

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
