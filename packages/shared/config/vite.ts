import path from 'path'
import { AliasOptions } from 'vite'

export const commonAlias: AliasOptions = {
  '@advjs/core/': `${path.resolve(__dirname, '../', '../core/src')}/`,
  '@advjs/editor/': `${path.resolve(__dirname, '../', '../editor/src')}/`,
  '@advjs/parser/': `${path.resolve(__dirname, '../', '../parser/src')}/`,
  '@advjs/shared/': `${path.resolve(__dirname, '../', '../shared/src')}/`,
}
