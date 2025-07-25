import type { ResolvedAdvOptions } from '@advjs/types'
import type { AdvPluginOptions } from '..'

import UnoCSS from 'unocss/vite'
import setupUnocss from '../setups/unocss'

export async function createUnocssPlugin(
  options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
) {
  return UnoCSS({
    configFile: false,
    ...await setupUnocss(options),
    ...pluginOptions.unocss,
  })
}
