import type { Plugin } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { notNullish } from '@antfu/utils'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import LinkAttributes from 'markdown-it-link-attributes'
import Markdown from 'vite-plugin-md'
import VueI18n from '@intlify/vite-plugin-vue-i18n'

import Adv from '@advjs/plugin-vite'

import type { AdvPluginOptions, AdvServerOptions, ResolvedAdvOptions } from '../options'
import { createConfigPlugin } from './extendConfig'
// import { createClientSetupPlugin } from './setupClient'
import { createUnocssPlugin } from './unocss'
import { createAdvLoader } from './loaders'

const customElements = new Set([
  '',
])

export async function ViteAdvPlugin(
  options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  serverOptions: AdvServerOptions = {},
): Promise<Plugin[]> {
  const {
    vue: vueOptions = {},
    components: componentsOptions = {},
  } = pluginOptions

  const {
    themeRoot,
    clientRoot,
    roots,
  } = options

  return [
    await createUnocssPlugin(options, pluginOptions),

    Vue({
      include: [/\.vue$/, /\.md$/],
      exclude: [],
      template: {
        compilerOptions: {
          isCustomElement(tag) {
            return customElements.has(tag)
          },
        },
        ...vueOptions?.template,
      },
      ...vueOptions,
    }),

    // https://github.com/hannoeru/vite-plugin-pages
    Pages({
      extensions: ['vue', 'md'],
      dirs: roots.map(root => `${root}/pages`),
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: roots.map(root => `${root}/layouts`),
    }),

    createAdvLoader(options),

    // createSlidesLoader(options, pluginOptions, serverOptions, VuePlugin, MarkdownPlugin),

    Components({
      extensions: ['vue', 'md', 'ts'],

      dirs: [
        `${clientRoot}/builtin`,
        `${clientRoot}/components`,
        `${themeRoot}/components`,
        'src/components',
        'components',
      ],

      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      exclude: [],

      ...componentsOptions,
    }),

    // https://github.com/antfu/vite-plugin-md
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
      exclude: ['**/*.adv.md'],
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: roots.map(root => `${root}/locales/**`),
    }),

    Adv(),

    // todo download remote assets

    createConfigPlugin(options),
  ]
    .flat()
    .filter(notNullish)
}
