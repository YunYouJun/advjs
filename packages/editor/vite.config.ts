import path from 'path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Markdown from 'vite-plugin-md'
import WindiCSS from 'vite-plugin-windicss'
import { VitePWA } from 'vite-plugin-pwa'
import VueI18n from '@intlify/vite-plugin-vue-i18n'
import Inspect from 'vite-plugin-inspect'

import Prism from 'markdown-it-prism'
import LinkAttributes from 'markdown-it-link-attributes'

import Adv from '../unplugin-adv/src/vite'

const markdownWrapperClasses = 'prose prose-sm m-auto text-left'
const monacoPrefix = 'monaco-editor/esm/vs'

// const defaultThemeFolder = path.resolve(__dirname, './src/client/theme-default/')

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@advjs/editor/': `${path.resolve(__dirname, './src')}/`,
      '@advjs/parser/': `${path.resolve(__dirname, '../parser/src')}/`,
      '@advjs/shared/': `${path.resolve(__dirname, '../shared/src')}/`,
    },
  },

  plugins: [
    Vue({
      include: [/\.vue$/, /\.md$/],
      template: {
        compilerOptions: {
          isCustomElement: (tag) => {
            return ['github-corners'].includes(tag)
          },
        },
      },
    }),

    // https://github.com/hannoeru/vite-plugin-pages
    Pages({
      extensions: ['vue', 'md'],
    }),

    // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
    Layouts(),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'vue-i18n',
        '@vueuse/head',
        '@vueuse/core',
      ],
      dts: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      // allow auto load markdown components under `./src/components/`
      extensions: ['vue', 'md'],

      dts: true,

      // allow auto import and register components used in markdown
      include: [/\.vue$/, /\.vue\?vue/, /\.md$/],

      // custom resolvers
      resolvers: [
        // auto import icons
        // https://github.com/antfu/unplugin-icons
        IconsResolver({
          // componentPrefix: '',
          // enabledCollections: ['carbon']
        }),
      ],
    }),

    // https://github.com/antfu/unplugin-icons
    Icons({
      autoInstall: true,
    }),

    // https://github.com/antfu/vite-plugin-windicss
    WindiCSS({
      safelist: markdownWrapperClasses,
    }),

    // https://github.com/antfu/vite-plugin-md
    // Don't need this? Try vitesse-lite: https://github.com/antfu/vitesse-lite
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
    }),

    // https://github.com/antfu/vite-plugin-pwa
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ADV.JS',
        short_name: 'ADV',
        theme_color: '#000',
      },
    }),

    // https://github.com/intlify/bundle-tools/tree/main/packages/vite-plugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      include: [path.resolve(__dirname, 'locales/**')],
    }),

    // https://github.com/antfu/vite-plugin-inspect
    Inspect({
      // change this to enable inspect for debugging
      enabled: false,
    }),

    Adv(),
  ],

  server: {
    fs: {
      strict: true,
    },
  },

  optimizeDeps: {
    include: [
      'vue',
      'vue-router',
      '@vueuse/core',
      '@vueuse/head',
    ],
    exclude: ['vue-demi'],
  },

  build: {
    rollupOptions: {
      // input: {
      //   main: path.resolve(__dirname, 'index.html'),
      //   parser: path.resolve(__dirname, '/parser/index.html'),
      // },
      output: {
        inlineDynamicImports: false,
        manualChunks: {
          editorWorker: [`${monacoPrefix}/editor/editor.worker`],
          jsonWorker: [`${monacoPrefix}/language/json/json.worker`],
          // cssWorker: [`${monacoPrefix}/language/css/css.worker`],
          // htmlWorker: [`${monacoPrefix}/language/html/html.worker`],
          // tsWorker: [`${monacoPrefix}/language/typescript/ts.worker`],
        },
      },
    },
  },
})
