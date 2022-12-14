import { loadConfig } from 'c12'
import type { AdvConfig } from '@advjs/types'
import { defaultConfig } from '@advjs/parser'

export function defineAdvConfig(config: AdvConfig) {
  return config
}

/**
 * resolve adv.config.ts
 */
export async function resolveAdvConfig() {
  const { config, configFile } = await loadConfig<AdvConfig>({
    name: 'adv',
    defaultConfig,
  })
  return {
    config,
    configFile,
  }
}
