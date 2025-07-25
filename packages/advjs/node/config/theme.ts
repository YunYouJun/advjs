import type { AdvEntryOptions } from '@advjs/types'
import process from 'node:process'
import { loadConfig } from 'c12'

/**
 * resolve theme config from special root
 */
export async function resolveThemeConfigFromRoot(root: string) {
  return loadConfig<any>({
    cwd: root,
    configFile: 'theme.config',
    // defaultConfig:
  })
}

/**
 * Resolve user theme config
 */
export async function loadAdvThemeConfig(options: AdvEntryOptions) {
  const { config: themeConfig, configFile: themeConfigFile } = await resolveThemeConfigFromRoot(options.userRoot || process.cwd())

  return {
    themeConfig,
    themeConfigFile,
  }
}
