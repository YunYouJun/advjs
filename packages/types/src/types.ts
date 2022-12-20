import type { AdvConfig } from './config'

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

export interface AdvMarkdown {
  // advjs: AdvInfo[]
  raw: string
  config: AdvConfig
  features: AdvFeatureFlags
  frontmatter: Record<string, unknown>

  filepath?: string
  entries?: string[]
  themeMeta?: AdvThemeMeta
}
