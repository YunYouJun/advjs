import type { AdvConfig } from './config'

/**
 * Metadata for "advjs" field in themes' package.json
 */
export interface AdvThemeMeta {
  // defaults?: Partial<AdvConfig>
  colorSchema?: 'dark' | 'light' | 'both'
}

export interface AdvMarkdown {
  // advjs: AdvInfo[]
  raw: string
  config: AdvConfig
  // features: AdvFeatureFlags
  headmatter: Record<string, unknown>

  filepath?: string
  entries?: string[]
  themeMeta?: AdvThemeMeta
}
