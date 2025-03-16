import type { AdvGameConfig } from '@advjs/types'
import { defaultGameConfig } from '@advjs/core'
import { loadConfig } from 'c12'

/**
 * load game.config.ts
 */
export async function loadAdvGameConfig() {
  const { config: gameConfig, configFile: gameConfigFile } = await loadConfig<AdvGameConfig>({
    name: 'game',
    defaultConfig: defaultGameConfig,
  })

  return {
    gameConfig,
    gameConfigFile,
  }
}
