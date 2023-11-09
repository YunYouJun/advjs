import { loadConfig } from 'c12'
import type { AdvConfig } from '@advjs/types'
import { defaultConfig } from '@advjs/core'
import type { AdvUserConfig } from '../options'

export const ADV_VIRTUAL_MODULES = [
  'virtual:advjs/adv.config',
  'virtual:advjs/app.config',
  'virtual:advjs/theme.config',
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
