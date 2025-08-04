import path from 'node:path'
import Shiki from '@shikijs/markdown-it'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import LinkAttributes from 'markdown-it-link-attributes'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Mockery from 'unplugin-mockery/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'
import Markdown from 'unplugin-vue-markdown/vite'
import { VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import VueDevTools from 'vite-plugin-vue-devtools'
import generateSitemap from 'vite-ssg-sitemap'
import { resolveOptions } from '../packages/advjs/node/options'
import { commonAliasMap } from '../packages/shared/node/vite'

import ADV from '../packages/vite-plugin-adv/src'
import 'vitest/config'

export default defineConfig(async ({ mode }) => {
  const options = await resolveOptions({
    env: 'plugin',
    theme: 'pominis',
  }, mode)

  return {
    resolve: {
      alias: {
        '~/': `${path.resolve(__dirname, 'src')}/`,
        ...commonAliasMap,
      },
    },

    build: {
      // temp for debug
      minify: false,
    },

    server: {
      cors: true,

      // proxy: {
      //   '^/v1/adv': {
      //     target: 'https://api.pominis.com/v1/adv',
      //     changeOrigin: true,
      //   },
      // },

      headers: {
        'access-control-allow-origin': '*',

        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },

      origin: 'https://play.pominis.com',
    },

    plugins: [
      Vue({
        include: [/\.vue$/, /\.md$/],
      }),

      // https://github.com/posva/unplugin-vue-router
      VueRouter({
        extensions: ['.vue', '.md'],
        dts: 'src/typed-router.d.ts',
      }),

      ADV(options, {
        components: {
          resolvers: [
            TDesignResolver({
              library: 'vue-next',
            }),
          ],
        },
      }),

      // https://github.com/antfu/unplugin-auto-import
      AutoImport({
        include: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],
        imports: [
          'vue',
          'vue-i18n',
          '@vueuse/core',
          unheadVueComposablesImports,
          VueRouterAutoImports,
          {
          // add any other imports you were relying on
            'vue-router/auto': ['useLink'],
          },
        ],
        dts: 'src/auto-imports.d.ts',
        dirs: [
          'src/composables',
          'src/stores',
        ],
        vueTemplate: true,
      }),

      // https://github.com/antfu/unocss
      // see uno.config.ts for config
      Unocss(),

      // https://github.com/unplugin/unplugin-vue-markdown
      // Don't need this? Try vitesse-lite: https://github.com/antfu/vitesse-lite
      Markdown({
        wrapperClasses: 'prose prose-sm m-auto text-left',
        headEnabled: true,
        async markdownItSetup(md) {
          md.use(LinkAttributes, {
            matcher: (link: string) => /^https?:\/\//.test(link),
            attrs: {
              target: '_blank',
              rel: 'noopener',
            },
          })
          md.use(await Shiki({
            defaultColor: false,
            themes: {
              light: 'vitesse-light',
              dark: 'vitesse-dark',
            },
          }))
        },
      }),

      // https://github.com/antfu/vite-plugin-pwa
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'ADV.JS Playground',
          short_name: 'Play',
          theme_color: '#ffffff',
        },
      }),

      // https://github.com/webfansplz/vite-plugin-vue-devtools
      VueDevTools(),

      Mockery({
        client: {
          port: 51274,
        },
      }),
    ],

    // https://github.com/vitest-dev/vitest
    test: {
      include: ['test/**/*.test.ts'],
      environment: 'jsdom',
    },

    // https://github.com/antfu/vite-ssg
    ssgOptions: {
      beastiesOptions: {
        reduceInlineStyles: false,
      },
      onFinished() {
        generateSitemap()
      },
    },

    ssr: {
      // TODO: workaround until they support native ESM
      noExternal: ['workbox-window', /vue-i18n/],
    },
  }
})
