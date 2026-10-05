import type { VFile } from 'vfile'
import type { AdvConfig, AdvGameConfig, ThemeConfig as BaseThemeConfig } from './config'

export interface AdvFeatureFlags {
  /**
   * @default false
   *
   * enable babylon for 3d scenes
   */
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

export interface AdvData<ThemeConfig = BaseThemeConfig> {
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

/** Backwards-compatible name for the shared game theme contract. */
export type AdvThemeConfig = BaseThemeConfig
