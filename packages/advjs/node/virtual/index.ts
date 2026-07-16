import { templateConfigs } from './configs'
import { templateData } from './data'
import { templateGames } from './game'
import { templateLocales } from './locales'
import { templateRuntimePlugins } from './runtime-plugins'
import { templateSetups } from './setups'
import { templateStyles } from './styles'

export const templates = [
  templateData,
  templateLocales,
  templateStyles,
  templateRuntimePlugins,

  ...templateConfigs,
  ...templateGames,
  ...templateSetups,
]
