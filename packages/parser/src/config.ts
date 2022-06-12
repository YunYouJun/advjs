import type { AdvConfig } from '@advjs/types'

export function resolveConfig(frontmatter: any) {
  const defaultConfig: AdvConfig = {
    title: 'ADV.JS',
    favicon: '/favicon.svg',
    theme: 'default',
    themeConfig: {},
  }

  const config: AdvConfig = {
    ...defaultConfig,

    ...frontmatter,
  }

  return config
}
