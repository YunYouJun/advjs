import type { AdvConfig, AdvGameConfig } from '@advjs/types'
import type { AdvEntryOptions } from '../options'
import { defaultConfig, defaultGameConfig } from '@advjs/core'
import { loadConfig } from 'c12'
import defu from 'defu'
import { loadAdvGameConfig } from './game'
import { loadAdvThemeConfig } from './theme'

export const ADV_VIRTUAL_MODULES = [
  '@advjs/configs/adv',
  '@advjs/configs/game',
  '@advjs/configs/theme',
]

/**
 * `adv.config.ts`
 *
 * 游戏应用级别的配置，如游戏根目录、主题、特性等
 */
export function defineAdvConfig(config: Partial<AdvConfig>) {
  return config
}

/**
 * `game.config.ts`
 *
 * 游戏具体内容相关配置，如游戏章节、角色、资源等
 */
export function defineGameConfig(config: Partial<AdvGameConfig>) {
  return config
}

/**
 * `theme.config.ts`
 */
export function defineThemeConfig<ThemeConfig>(config: Partial<ThemeConfig>) {
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

/**
 * load
 *
 * - `adv.config.ts`
 * - `game.config.ts`
 * - `theme.config.ts`
 */
export async function loadAdvConfigs(options: AdvEntryOptions) {
  const [
    { config, configFile },
    { gameConfig, gameConfigFile },
    { themeConfig, themeConfigFile },
  ] = await Promise.all([
    loadAdvConfig(),
    loadAdvGameConfig(),
    loadAdvThemeConfig(options),
  ])

  return {
    config,
    configFile,
    gameConfig: defu(gameConfig, config.gameConfig, defaultGameConfig),
    gameConfigFile,
    themeConfig,
    themeConfigFile,
  }
}
