import { templateConfigs } from './configs'
import { templateData } from './data'
import { templateLocales } from './locales'
import { templateSetups } from './setups'
import { templateStyles } from './styles'

export const templates = [
  templateData,
  templateLocales,
  templateStyles,

  ...templateConfigs,
  ...templateSetups,
]
