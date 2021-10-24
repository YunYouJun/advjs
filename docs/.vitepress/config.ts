import { UserConfig } from 'vitepress'
import { DefaultTheme } from './theme/config'
import { metaData } from './config/constants'
import head from './config/head'
import themeConfig from './config/theme'

const config: UserConfig<DefaultTheme.Config> = {
  ...metaData,

  head,
  themeConfig,
  srcExclude: ['README.md'],
}

export default config
