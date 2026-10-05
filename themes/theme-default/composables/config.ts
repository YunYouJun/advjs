import type { ThemeConfig } from '../types'
import { useThemeConfig as useClientThemeConfig } from '@advjs/client'

export function useThemeConfig<T extends object = ThemeConfig>() {
  return useClientThemeConfig<T>()
}
