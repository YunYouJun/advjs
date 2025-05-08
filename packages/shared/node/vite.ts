import type { Alias } from 'vite'
import path, { resolve } from 'node:path'

/**
 * monorepo packages folder
 */
export const packagesDir = path.resolve(import.meta.dirname, '../../')
export const themesDir = path.resolve(import.meta.dirname, '../../../themes')
export const pluginsDir = path.resolve(import.meta.dirname, '../../../plugins')

export const defaultThemeFolder = path.resolve(themesDir, 'theme-default')

export const commonAlias: Alias[] = [
  // { find: '@advjs/client/', replacement: `${resolve(packagesDir, 'client')}/` },
  // { find: '@advjs/client', replacement: `${resolve(packagesDir, 'client')}/index.ts` },
  { find: '@advjs/examples/', replacement: `${resolve(packagesDir, 'examples')}/` },
  { find: '@advjs/gui/', replacement: `${resolve(packagesDir, 'gui')}/` },
  { find: '@advjs/gui', replacement: `${resolve(packagesDir, 'gui/client/')}` },
  { find: '@advjs/parser/fs', replacement: `${resolve(packagesDir, 'parser/src')}/fs.ts` },
  { find: '@advjs/shared/', replacement: `${resolve(packagesDir, 'shared/src')}/` },
  { find: '@advjs/plugin-babylon', replacement: `${resolve(packagesDir, 'plugin-babylon/src')}/` },
  // themes
  // { find: '@advjs/theme-default/', replacement: `${resolve(defaultThemeFolder)}/` },
  // { find: '@advjs/theme-default', replacement: `${resolve(defaultThemeFolder)}/index.ts` },

  { find: '@advjs/flow', replacement: `${resolve(packagesDir, 'flow')}/index.ts` },
  { find: '@advjs/flow/', replacement: `${resolve(packagesDir, 'flow')}/` },

  { find: '@advjs/core', replacement: `${resolve(packagesDir, 'core/src')}/index.ts` },
  { find: '@advjs/parser', replacement: `${resolve(packagesDir, 'parser/src', 'index.ts')}` },
  { find: '@advjs/shared', replacement: `${resolve(packagesDir, 'shared/src', 'index.ts')}` },
  { find: '@advjs/types', replacement: `${resolve(packagesDir, 'types/src', 'index.ts')}` },
]

export const commonAliasMap = Object.fromEntries(
  commonAlias.map(({ find, replacement }) => [find, replacement]),
)
