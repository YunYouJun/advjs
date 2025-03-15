import type { ConfigEnv, InlineConfig } from 'vite'
import type { AdvServerOptions, ResolvedAdvOptions } from '../options'

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfigFromFile, mergeConfig } from 'vite'
import { ViteAdvPlugin } from '..'

export async function resolveViteConfigs(
  options: ResolvedAdvOptions,
  baseConfig: InlineConfig,
  overrideConfigs: InlineConfig,
  command: 'serve' | 'build',
  serverOptions?: AdvServerOptions,
) {
  const configEnv: ConfigEnv = {
    mode: command === 'build' ? 'production' : 'development',
    command,
  }
  // Merge theme & addon & user configs
  const files = options.roots.map(i => join(i, 'vite.config.ts'))

  for (const file of files) {
    if (!existsSync(file))
      continue
    const viteConfig = await loadConfigFromFile(configEnv, file)
    if (!viteConfig?.config)
      continue
    baseConfig = mergeConfig(baseConfig, viteConfig.config)
  }

  baseConfig = mergeConfig(baseConfig, overrideConfigs)

  // Merge common overrides
  baseConfig = mergeConfig(baseConfig, {
    configFile: false,
    root: options.userRoot,
    plugins: await ViteAdvPlugin(options, {}, serverOptions),
    define: {
      // Fixes Vue production mode breaking PDF Export #1245
      __VUE_PROD_DEVTOOLS__: false,
    },
  } satisfies InlineConfig)

  return baseConfig
}
