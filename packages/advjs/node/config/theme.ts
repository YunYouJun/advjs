import type { AdvThemeConfig } from '@advjs/types'
import type { ResolvedAdvOptions } from '../options'
import { loadConfig } from 'c12'
import consola from 'consola'
import { colors } from 'consola/utils'
import fs from 'fs-extra'

/**
 * resolve theme config from special root
 */
export async function resolveThemeConfigFromRoot(root: string) {
  return loadConfig<AdvThemeConfig>({
    cwd: root,
    configFile: 'theme.config',
    // defaultConfig:
  })
}

/**
 * Resolve user theme config
 */
export async function loadAdvThemeConfig(options: ResolvedAdvOptions) {
  const { config: themeConfig, configFile: themeConfigFile } = await resolveThemeConfigFromRoot(options.userRoot)

  if (themeConfig && themeConfigFile)
    consola.info(`Resolve ${colors.cyan('themeConfig')} from ${colors.dim(themeConfigFile)}`) // updated code

  const { themeRoot } = options
  const pkg = await fs.readJSON(`${themeRoot}/package.json`)
  themeConfig.pkg = pkg

  return {
    themeConfig,
    themeConfigFile,
  }
}
