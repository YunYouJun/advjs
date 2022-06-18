import { resolve } from 'path'
import { existsSync } from 'fs'
import { slash, uniq } from '@antfu/utils'
import type { WindiCssOptions } from 'vite-plugin-windicss'
import WindiCSS from 'vite-plugin-windicss'
// import WindiCSS, { defaultConfigureFiles } from 'vite-plugin-windicss'
import jiti from 'jiti'
import type { AdvPluginOptions, ResolvedAdvOptions } from '..'
import { loadSetups } from './setupNode'

export async function createWindiCSSPlugin(
  { themeRoot, clientRoot, userRoot, roots }: ResolvedAdvOptions,
  { windicss: windiOptions }: AdvPluginOptions,
) {
  const configFiles = uniq([
    // ...defaultConfigureFiles.map(i => resolve(userRoot, i)),
    resolve(themeRoot, 'vite.config.ts'),
    resolve(clientRoot, 'windi.config.ts'),
  ])

  const configFile = configFiles.find(i => existsSync(i))!
  let config = jiti(__filename)(configFile) as WindiCssOptions
  if (config.default)
    config = config.default

  config = await loadSetups(roots, 'windicss.ts', {}, config, true)

  return WindiCSS(
    {
      configFiles: [configFile],
      config,
      onConfigResolved(config: any) {
        if (!config.theme)
          config.theme = {}
        if (!config.theme.extend)
          config.theme.extend = {}
        if (!config.theme.extend.fontFamily)
          config.theme.extend.fontFamily = {}

        return config
      },
      onOptionsResolved(config) {
        config.scanOptions.include.push(`${themeRoot}/components/**/*.{vue,ts}`)
        config.scanOptions.include.push(`${themeRoot}/layouts/**/*.{vue,ts}`)
        config.scanOptions.include.push(`!${slash(resolve(userRoot, 'node_modules'))}`)
      },
      ...windiOptions,
    },
  )
}
