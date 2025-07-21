import type { PluginOption } from 'vite'
import type { AdvPluginOptions, AdvServerOptions, ResolvedAdvOptions } from '../options'
import { join } from 'node:path'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import fs from 'fs-extra'
import LinkAttributes from 'markdown-it-link-attributes'
import { resolve } from 'pathe'

import Markdown from 'unplugin-vue-markdown/vite'
import VueRouter from 'unplugin-vue-router/vite'
import vueDevTools from 'vite-plugin-vue-devtools'

import Layouts from 'vite-plugin-vue-layouts'
import { createComponentsPlugin } from './components'
import { createConfigPlugin } from './extendConfig'
import { createAdvLoader } from './loaders'
// import { createClientSetupPlugin } from './setupClient'
import { createUnocssPlugin } from './unocss'
import { createVuePlugin } from './vue'

export async function ViteAdvPlugin(
  options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
  serverOptions: AdvServerOptions = {},
): Promise<PluginOption[]> {
  // generated files for adv
  fs.ensureDirSync(options.tempRoot)

  return Promise.all([
    createConfigPlugin(options),
    createUnocssPlugin(options, pluginOptions),

    createVuePlugin(options, pluginOptions),
    createAdvLoader(options, serverOptions),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      routesFolder: options.roots.map(root => join(root, 'pages')),
      exclude: ['**/*.adv.md'],
      dts: resolve(options.tempRoot, 'typed-router.d.ts'),
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: options.roots.map(root => join(root, 'layouts')),
    }),

    createComponentsPlugin(options, pluginOptions),

    // https://github.com/unplugin/unplugin-vue-markdown/
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
      include: options.roots.map(root => `${root}/locales/**`),
    }),

    vueDevTools({
      appendTo: join(options.clientRoot, 'main.ts'),
    }),
    // todo download remote assets
  ])
}
