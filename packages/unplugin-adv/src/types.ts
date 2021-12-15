import type { FilterPattern } from '@rollup/pluginutils'

export interface Options {
  // define your plugin options here

  /**
   * Custom tranformations apply before and after the markdown transformation
   */
  transforms?: {
    before?: (code: string, id: string) => string
    after?: (code: string, id: string) => string
  }

  /**
   * Parse for frontmatter
   *
   * @default true
   */
  frontmatter?: boolean

  /**
   * Remove custom SFC block
   *
   * @default ['route', 'i18n']
   */
  customSfcBlocks?: string[]

  include?: FilterPattern
  exclude?: FilterPattern
}

export interface ResolvedOptions extends Required<Options> {}
