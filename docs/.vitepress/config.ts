import { UserConfig } from 'vitepress'
import type { YouTheme } from 'vitepress-theme-you'
import { metaData } from './config/constants'
import head from './config/head'
import themeConfig from './config/theme'

const config: UserConfig<YouTheme.Config> = {
  ...metaData,

  head,
  themeConfig,
  srcExclude: ['README.md'],
}

export default config
