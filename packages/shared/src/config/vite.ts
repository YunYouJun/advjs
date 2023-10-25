import path from 'node:path'
import type { AliasOptions } from 'vite'

export const defaultThemeFolder = path.resolve(__dirname, '../../', '../theme-default')

export const commonAlias: AliasOptions = {
  '@advjs/client/': `${path.resolve(__dirname, '../../', '../client')}/`,
  '@advjs/core': `${path.resolve(__dirname, '../../', '../core/src')}/`,
  '@advjs/examples/': `${path.resolve(__dirname, '../../', '../examples')}/`,
  '@advjs/parser/': `${path.resolve(__dirname, '../../', '../parser/src')}/`,
  '@advjs/shared/': `${path.resolve(__dirname, '../../', '../shared/src')}/`,
  '@advjs/theme-default/': `${defaultThemeFolder}/`,
  '@advjs/theme-default': defaultThemeFolder,
}
