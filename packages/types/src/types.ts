import type { VFile } from 'vfile'
import type { AdvConfig } from './config'
import type { AdvThemeConfig } from './theme'

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

export interface AdvData {
  file: VFile
  // advjs: AdvInfo[]
  raw: string
  frontmatter: Record<string, unknown>

  filepath?: string
  entries?: string[]

  /**
   * Adv Config
   */
  config: AdvConfig
  configFile: string

  /**
   * theme
   */
  themeMeta?: AdvThemeMeta
  themeConfig: AdvThemeConfig
  themeConfigFile?: string
}
