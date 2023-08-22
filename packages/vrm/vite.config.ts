import path from 'node:path'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Pages from 'vite-plugin-pages'
import Layouts from 'vite-plugin-vue-layouts'
import Components from 'unplugin-vue-components/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import Inspect from 'vite-plugin-inspect'
import Prism from 'markdown-it-prism'
import LinkAttributes from 'markdown-it-link-attributes'
import Unocss from 'unocss/vite'

// https://github.com/vitejs/vite/issues/5370
// todo: wait released https://github.com/vitejs/vite/pull/10254
// import { commonAlias } from '@advjs/shared/config/vite'
const defaultThemeFolder = path.resolve(__dirname, '../theme-default')

const markdownWrapperClasses = 'prose prose-sm m-auto text-left'
export default defineConfig((config) => {
  return {
    define: {
      __DEV__: config.mode === 'development',
    },
    resolve: {
      alias: Object.assign(
        {
          '~/': `${path.resolve(__dirname, 'src')}/`,
        },
        // commonAlias,
        {
          '@advjs/client/': `${path.resolve(__dirname, '../client')}/`,
          '@advjs/core': `${path.resolve(__dirname, '../core/src')}/`,
          '@advjs/examples/': `${path.resolve(__dirname, '../examples')}/`,
          '@advjs/parser/': `${path.resolve(__dirname, '../parser/src')}/`,
          '@advjs/shared/': `${path.resolve(__dirname, '../shared/src')}/`,
          '@advjs/theme-default': defaultThemeFolder,
          '@advjs/theme-default/': `${defaultThemeFolder}/`,
        },
      ),
    },

    build: {
      rollupOptions: {
        external: ['/@advjs/configs'],
      },
    },

    plugins: [
      Vue({
        include: [/\.vue$/, /\.md$/],
      }),

      // https://github.com/hannoeru/vite-plugin-pages
      Pages({
        extensions: ['vue', 'md'],
      }),

      // https://github.com/JohnCampionJr/vite-plugin-vue-layouts
      Layouts(),

      // https://github.com/antfu/unplugin-vue-components
      Components({
        dirs: ['src/components', '../theme-default/components'],
        // allow auto load markdown components under `./src/components/`
        extensions: ['vue', 'md'],

        // allow auto import and register components used in markdown
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        dts: 'src/components.d.ts',
      }),

      // https://github.com/antfu/unocss
      // see unocss.config.ts for config
      Unocss(),

      // https://github.com/antfu/unplugin-vue-markdown
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
        exclude: ['**/*.adv.md'],
      }),

      // https://github.com/antfu/vite-plugin-pwa
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'robots.txt'],
        manifest: {
          name: 'VRM Editor',
          short_name: 'VRM',
          theme_color: '#0078e7',
        },
      }),

      // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
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
    ],

    // https://github.com/vitest-dev/vitest
    test: {
      include: ['test/**/*.test.ts'],
      environment: 'jsdom',
      deps: {
        inline: ['@vue', '@vueuse', 'vue-demi'],
      },
    },

    // https://github.com/antfu/vite-ssg
    ssgOptions: {
      script: 'async',
      formatting: 'minify',
    },

    ssr: {
      // TODO: workaround until they support native ESM
      noExternal: ['workbox-window', /vue-i18n/],
    },
  }
})
