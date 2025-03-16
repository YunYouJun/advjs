import type { PluginOption } from 'vite'
import type { AdvPluginOptions, AdvServerOptions, ResolvedAdvOptions } from '../options'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import fs from 'fs-extra'
import LinkAttributes from 'markdown-it-link-attributes'
import { resolve } from 'pathe'
import Components from 'unplugin-vue-components/vite'

import Markdown from 'unplugin-vue-markdown/vite'
import VueRouter from 'unplugin-vue-router/vite'
import Layouts from 'vite-plugin-vue-layouts'
import { createVuePlugin } from '../vite/vue'

import { createConfigPlugin } from './extendConfig'
import { createAdvLoader } from './loaders'
// import { createClientSetupPlugin } from './setupClient'
import { createUnocssPlugin } from './unocss'

export async function ViteAdvPlugin(
  options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
  serverOptions: AdvServerOptions = {},
): Promise<PluginOption[]> {
  const {
    components: componentsOptions = {},
  } = pluginOptions

  const {
    clientRoot,
    userRoot,
    roots,
  } = options

  // generated files for adv
  const tempDir = resolve(userRoot, '.adv')
  fs.ensureDirSync(resolve(userRoot, '.adv'))

  return Promise.all([
    createConfigPlugin(options),
    createUnocssPlugin(options, pluginOptions),

    createVuePlugin(options, pluginOptions),
    createAdvLoader(options, serverOptions),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      routesFolder: roots.map(root => `${root}/pages`),
      exclude: ['**/*.adv.md'],
      dts: resolve(tempDir, 'typed-router.d.ts'),
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: roots.map(root => `${root}/layouts`),
    }),

    Components({
      extensions: ['vue', 'md'],

      dirs: roots
        .map(root => `${root}/components`)
        .concat([`${clientRoot}/builtin`]),

      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      dts: resolve(tempDir, 'components.d.ts'),

      ...componentsOptions,
    }),

    // https://github.com/antfu/unplugin-vue-markdown
    Markdown({
      wrapperClasses: 'markdown-body',
      headEnabled: true,
      markdownItSetup(md) {
        md.use(LinkAttributes, {
          pattern: /^https?:\/\//,
          attrs: {
            target: '_blank',
            rel: 'noopener',
          },
        })
      },
      // avoid conflict with adv
      exclude: ['**/*.adv.md'],
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: roots.map(root => `${root}/locales/**`),
    }),

    // todo download remote assets
  ])
}
