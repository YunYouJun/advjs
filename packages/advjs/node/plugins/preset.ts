import path from 'path'
import type { PluginOption } from 'vite'
import Vue from '@vitejs/plugin-vue'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import { notNullish } from '@antfu/utils'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import AutoImport from 'unplugin-auto-import/vite'
import Prism from 'markdown-it-prism'
import LinkAttributes from 'markdown-it-link-attributes'
import Icons from 'unplugin-icons/vite'
import Markdown from 'vite-plugin-md'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import type { AdvPluginOptions, ResolvedAdvOptions } from '../options'
import Adv from '../../../unplugin-adv/src/vite'
import { createConfigPlugin } from './extendConfig'
// import { createAdvLoader } from './loaders'
// import { createClientSetupPlugin } from './setupClient'
import { createWindiCSSPlugin } from './windicss'
import { createAdvLoader } from './loaders'

const customElements = new Set([
  '',
])

export async function ViteAdvPlugin(
  options: ResolvedAdvOptions,
  pluginOptions: AdvPluginOptions,
  // serverOptions: AdvServerOptions = {},
): Promise<PluginOption[]> {
  const {
    vue: vueOptions = {},
    components: componentsOptions = {},
    icons: iconsOptions = {},
  } = pluginOptions

  const {
    themeRoots,
    clientRoot,
  } = options

  return [
    await createWindiCSSPlugin(options, pluginOptions),

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
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts({
      layoutsDirs: '../theme-default/layouts',
    }),

    createAdvLoader(),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'vue-i18n',
        '@vueuse/head',
        '@vueuse/core',
      ],
      dts: 'src/auto-imports.d.ts',
    }),

    // createSlidesLoader(options, pluginOptions, serverOptions, VuePlugin, MarkdownPlugin),

    Components({
      extensions: ['vue', 'md', 'ts'],

      dirs: [
        `${clientRoot}/builtin`,
        `${clientRoot}/components`,
        ...themeRoots.map(i => `${i}/components`),
        'src/components',
        'components',
      ],

      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
      exclude: [],

      resolvers: [
        IconsResolver({
          // prefix: '',
          customCollections: Object.keys(iconsOptions.customCollections || []),
        }),
      ],

      ...componentsOptions,
    }),

    // https://github.com/antfu/unplugin-icons
    Icons({
      autoInstall: true,
    }),

    // https://github.com/antfu/vite-plugin-md
    Markdown({
      wrapperClasses: markdownWrapperClasses,
      headEnabled: true,
      markdownItSetup(md) {
        // https://prismjs.com/
        md.use(Prism)
        md.use(LinkAttributes, {
          pattern: /^https?:\/\//,
          attrs: {
            target: '_blank',
            rel: 'noopener',
          },
        })
      },
      exclude: [path.resolve(__dirname, '../examples/*.md')],
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: [path.resolve(__dirname, 'locales/**')],
    }),

    Adv(),

    // todo download remote assets

    createConfigPlugin(options),
  ]
    .flat()
    .filter(notNullish)
}
