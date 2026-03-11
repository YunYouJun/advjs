import type { ResolvedAdvOptions } from '@advjs/types'
import type { AdvPluginOptions } from '../options'
import path, { join } from 'node:path'
import Components from 'unplugin-vue-components/vite'

const vueFilePattern = /\.vue$/
const vueQueryPattern = /\.vue\?vue/
const mdFilePattern = /\.md$/
const gitExcludePattern = /[\\/]\.git[\\/]/
const nuxtExcludePattern = /[\\/]\.nuxt[\\/]/

/**
 * @see // https://github.com/antfu/unplugin-vue-components
 * @param options
 * @param pluginOptions
 */
export function createComponentsPlugin(options: ResolvedAdvOptions, pluginOptions: AdvPluginOptions) {
  return Components({
    extensions: ['vue', 'md'],

    include: [vueFilePattern, vueQueryPattern, mdFilePattern],
    // node_modules is needed to be search when install deps
    exclude: [gitExcludePattern, nuxtExcludePattern],
    dts: path.resolve(options.tempRoot, 'components.d.ts'),

    allowOverrides: true,

    ...pluginOptions.components,
    dirs: [
      ...[...options.roots
        .map(root => join(root, 'components')), ...[
        join(options.clientRoot, 'builtin'),
      ]],
      ...pluginOptions.components?.dirs || [],
    ],
  })
}
