import path from 'path'
import { AliasOptions } from 'vite'

export const commonAlias: AliasOptions = {
  '@advjs/editor/': `${path.resolve(__dirname, '../', '../editor/src')}/`,
  'markdown-it-adv': `${path.resolve(__dirname, '../', '../markdown-it-adv/src')}/`,
  '@advjs/parser/': `${path.resolve(__dirname, '../', '../parser/src')}/`,
  '@advjs/shared/': `${path.resolve(__dirname, '../', '../shared/src')}/`,
}
