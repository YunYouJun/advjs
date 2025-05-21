import { colors } from 'consola/utils'
import { initTheme } from './theme'

export const renameFiles: Record<string, string> = {
  _gitignore: '.gitignore',
  _npmrc: '.npmrc',
}

export const TEMPLATES = [
  {
    name: 'adv',
    display: `ADV.JS Project`,
    desc: 'For Most Users',
    message: 'Project name:',
    initial: 'advjs-project',
    color: colors.cyan,
  },
  {
    name: 'theme',
    display: `Theme`,
    desc: 'For Theme Developers',
    message: 'Theme name: advjs-theme-',
    initial: 'starter',
    prefix: 'advjs-theme-',
    color: colors.green,
    customInit: async (options: {
      themeName?: string
    }) => {
      return initTheme(options).catch((e) => {
        console.error(e)
      })
    },
  },
  {
    name: 'plugin',
    display: `Plugin`,
    desc: 'For Plugin Developers',
    message: 'Plugin name: advjs-plugin-',
    initial: 'template',
    prefix: 'advjs-plugin-',
    color: colors.yellow,
  },
]

export const TEMPLATE_CHOICES = TEMPLATES.map(template => template.name)
