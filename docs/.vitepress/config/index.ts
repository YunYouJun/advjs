import { UserConfig } from 'vitepress'
import { DefaultTheme } from '../theme/config'
import { metaData } from './constants'
import head from './head'
import themeConfig from './theme'

const config: UserConfig<DefaultTheme.Config> = {
  ...metaData,

  head,
  themeConfig,
  srcExclude: ['README.md'],
}

export default config
