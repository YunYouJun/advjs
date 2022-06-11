import type { AdvConfig } from '@advjs/types'

export function resolveConfig() {
  const defaultConfig: AdvConfig = {
    title: 'ADV.JS',
    favicon: '/favicon.svg',
    theme: 'default',
    themeConfig: {},
  }

  const config: AdvConfig = {
    ...defaultConfig,
  }

  return config
}
