import type { AdvConfig, AdvEntryOptions, AdvGameConfig, ThemeConfig } from '@advjs/types'
import { loadConfig } from 'c12'
import defu from 'defu'
import { defaultAdvConfig, defaultGameConfig } from '../../shared'
import { bundledConfigAliases } from './aliases'
import { loadAdvGameConfig } from './game'
import { loadAdvThemeConfig } from './theme'

export const ADV_VIRTUAL_MODULES = [
  '@advjs/configs/adv',
  '@advjs/configs/game',
  '@advjs/configs/theme',
  '#advjs/runtime-plugins',
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
 * Infer custom fields without widening the reserved game UI contract.
 */
export function defineThemeConfig<T extends object = ThemeConfig>(config: {
  [K in keyof T]?: K extends 'ui' ? ThemeConfig['ui'] : T[K]
} & Pick<ThemeConfig, 'ui'>) {
  return config
}

/**
 * resolve adv.config.ts
 */
export async function loadAdvConfig(options: AdvEntryOptions) {
  if (options.advConfig) {
    return {
      config: defu(options.advConfig, defaultAdvConfig) as AdvConfig,
      configFile: '',
    }
  }

  const { config, configFile } = await loadConfig<AdvConfig>({
    name: 'adv',
    cwd: options.userRoot,
    jitiOptions: { alias: bundledConfigAliases() },
    defaultConfig: defaultAdvConfig,
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
    loadAdvConfig(options),
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
