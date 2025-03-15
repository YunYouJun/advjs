import { templateConfigs } from './configs'
import { templateLocales } from './locales'
import { templateSetups } from './setups'
import { templateStyles } from './styles'

export const templates = [
  templateLocales,
  templateStyles,

  ...templateConfigs,
  ...templateSetups,
]
