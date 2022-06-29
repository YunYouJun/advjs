import path from 'path'
import type { AliasOptions } from 'vite'

export const commonAlias: AliasOptions = {
  '@advjs/core': `${path.resolve(__dirname, '../', '../core/src')}/`,
  '@advjs/editor/': `${path.resolve(__dirname, '../', '../editor/src')}/`,
  '@advjs/examples/': `${path.resolve(__dirname, '../', '../examples')}/`,
  '@advjs/parser/': `${path.resolve(__dirname, '../', '../parser/src')}/`,
  '@advjs/shared/': `${path.resolve(__dirname, '../', '../shared/src')}/`,
  '@advjs/theme-default': `${path.resolve(__dirname, '../', '../theme-default')}`,
  '@advjs/theme-default/': `${path.resolve(__dirname, '../', '../theme-default')}/`,
}
