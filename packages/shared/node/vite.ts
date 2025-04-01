import type { AliasOptions } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
/**
 * monorepo packages folder
 */
export const packagesFolder = path.resolve(__dirname, '../../')

export const defaultThemeFolder = path.resolve(packagesFolder, 'theme-default')
export const commonAlias: AliasOptions = {
  '@advjs/client/': `${path.resolve(packagesFolder, 'client')}/`,
  '@advjs/client': `${path.resolve(packagesFolder, 'client')}/index.ts`,
  '@advjs/examples/': `${path.resolve(packagesFolder, 'examples')}/`,

  '@advjs/gui/': `${path.resolve(packagesFolder, 'gui')}/`,
  '@advjs/gui': `${path.resolve(packagesFolder, 'gui/client/')}`,

  '@advjs/core': `${path.resolve(packagesFolder, 'core/src')}/`,
  '@advjs/parser/': `${path.resolve(packagesFolder, 'parser/src')}/`,
  '@advjs/shared/': `${path.resolve(packagesFolder, 'shared/src')}/`,
  '@advjs/plugin-babylon': `${path.resolve(packagesFolder, 'plugin-babylon/src')}/`,

  '@advjs/types': `${path.resolve(packagesFolder, 'types/src')}/index.ts`,

  '@advjs/theme-default/': `${defaultThemeFolder}/`,
  '@advjs/theme-default': defaultThemeFolder,

  '@advjs/flow': `${path.resolve(packagesFolder, 'flow')}/index.ts`,
  '@advjs/flow/': `${path.resolve(packagesFolder, 'flow')}/`,
}
