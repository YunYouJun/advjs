import { resolve } from 'node:path'
import { commonAlias } from '../../packages/shared/node'
import { pwa } from './config/pwa'
import { appDescription } from './constants/index'

const alias = commonAlias as Record<string, string>

export default defineNuxtConfig({
  // ssr: false,
  routeRules: {
    '/': { ssr: false },
  },

  alias: {
    '@advjs/editor': `${resolve(__dirname, '.')}`,
    ...alias,
  },

  modules: [
    '@vueuse/nuxt',
    '@unocss/nuxt',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@vite-pwa/nuxt',

    '@advjs/gui/nuxt',
  ],

  experimental: {
    // when using generate, payload js assets included in sw precache manifest
    // but missing on offline, disabling extraction it until fixed
    payloadExtraction: false,
    // inlineSSRStyles: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  css: [
    '@unocss/reset/tailwind.css',
    '~/styles/index.scss',
  ],

  colorMode: {
    classSuffix: '',
  },

  nitro: {
    esbuild: {
      options: {
        target: 'esnext',
      },
    },
    prerender: {
      crawlLinks: false,
      routes: ['/'],
      ignore: ['/hi'],
    },
  },

  app: {
    head: {
      viewport: 'width=device-width,initial-scale=1',
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/svg+xml', href: '/nuxt.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
    },
  },

  components: [
    // remove prefix
    { path: '~/components', pathPrefix: false },
    { path: '../../packages/gui/src/components', pathPrefix: false },
  ],

  pwa,

  devtools: {
    enabled: true,
  },
})
