import type { ThemeConfig as BaseThemeConfig } from '@advjs/types'

export interface ThemeConfig extends BaseThemeConfig {
  assets?: {
    audio: {
      popDownUrl?: string
    }
  }
  audio?: {
    volume: number
  }
}
