import type { Plugin } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { notNullish } from '@antfu/utils'
import Layouts from 'vite-plugin-vue-layouts'
import LinkAttributes from 'markdown-it-link-attributes'
import Markdown from 'unplugin-vue-markdown/vite'
import VueRouter from 'unplugin-vue-router/vite'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'

import type { AdvPluginOptions, AdvServerOptions, ResolvedAdvOptions } from '../options'
import { customElements } from '../constants'
import { createConfigPlugin } from './extendConfig'

// import { createClientSetupPlugin } from './setupClient'
import { createUnocssPlugin } from './unocss'
import { createAdvLoader } from './loaders'

export async function ViteAdvPlugin(
  options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,

  _serverOptions: AdvServerOptions = {},
): Promise<Plugin[]> {
  const {
    vue: vueOptions = {},
    components: componentsOptions = {},
  } = pluginOptions

  const {
    clientRoot,
    roots,
  } = options

  const vuePlugin = Vue({
    include: [/\.vue$/, /\.md$/],
    template: {
      compilerOptions: {
        isCustomElement(tag) {
          return customElements.has(tag)
        },
      },
      ...vueOptions?.template,
    },
    ...vueOptions,
  })

  return [
    await createUnocssPlugin(options, pluginOptions),

    vuePlugin,
    createAdvLoader(options, vuePlugin),

    // https://github.com/posva/unplugin-vue-router
    VueRouter({
      extensions: ['.vue', '.md'],
      routesFolder: roots.map(root => `${root}/pages`),
      exclude: ['**/*.adv.md'],
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

    await createConfigPlugin(options),
  ]
    .flat()
    .filter(notNullish)
}
