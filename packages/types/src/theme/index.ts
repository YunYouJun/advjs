import type { DefaultTheme } from '@advjs/theme-default'

export type AdvThemeConfig = DefaultTheme.Config & {
  /**
   * theme package.json
   */
  pkg: {
    name: string
    version: string
    [key: string]: any
  }
}
