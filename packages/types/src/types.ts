import type { VFile } from 'vfile'
import type { AdvConfig, AdvGameConfig } from './config'

export interface AdvFeatureFlags {
  babylon: boolean
}

/**
 * Metadata for "advjs" field in themes' package.json
 */
export interface AdvThemeMeta {
  // defaults?: Partial<AdvConfig>
  type?: '2d' | '3d'
  colorSchema?: 'dark' | 'light' | 'both'
}

export interface AdvData<ThemeConfig = any> {
  file: VFile
  // advjs: AdvInfo[]
  raw: string
  frontmatter: Record<string, unknown>

  filepath?: string
  entries?: string[]

  watchFiles?: string[]

  /**
   * Adv Config
   */
  config: AdvConfig
  configFile: string

  /**
   * Game config
   */
  gameConfig: AdvGameConfig
  gameConfigFile: string

  /**
   * Theme
   */
  themeMeta?: AdvThemeMeta
  themeConfig: ThemeConfig & {
    /**
     * theme package.json
     */
    pkg: {
      name: string
      version: string
      [key: string]: any
    }
  }
  themeConfigFile?: string
}
