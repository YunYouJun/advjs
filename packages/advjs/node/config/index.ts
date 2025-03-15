import type { AdvConfig } from '@advjs/types'
import type { AdvUserConfig } from '../options'
import { defaultConfig } from '@advjs/core'
import { loadConfig } from 'c12'

export const ADV_VIRTUAL_MODULES = [
  '@advjs/configs/adv',
  '@advjs/configs/app',
  '@advjs/configs/theme',
]

export function defineAdvConfig(config: AdvUserConfig) {
  return config
}

/**
 * resolve adv.config.ts
 */
export async function loadAdvConfig() {
  const { config, configFile } = await loadConfig<AdvConfig>({
    name: 'adv',
    defaultConfig,
  })
  return {
    config,
    configFile,
  }
}
