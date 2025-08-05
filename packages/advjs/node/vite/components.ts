import type { ResolvedAdvOptions } from '@advjs/types'
import type { AdvPluginOptions } from '../options'
import path, { join } from 'node:path'
import Components from 'unplugin-vue-components/vite'

/**
 * @see // https://github.com/antfu/unplugin-vue-components
 * @param options
 * @param pluginOptions
 */
export function createComponentsPlugin(options: ResolvedAdvOptions, pluginOptions: AdvPluginOptions) {
  return Components({
    extensions: ['vue', 'md'],

    include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    // node_modules is needed to be search when install deps
    exclude: [/[\\/]\.git[\\/]/, /[\\/]\.nuxt[\\/]/],
    dts: path.resolve(options.tempRoot, 'components.d.ts'),

    allowOverrides: true,

    ...pluginOptions.components,
    dirs: [
      ...options.roots
        .map(root => join(root, 'components'))
        .concat([
          join(options.clientRoot, 'builtin'),
        ]),
      ...pluginOptions.components?.dirs || [],
    ],
  })
}
