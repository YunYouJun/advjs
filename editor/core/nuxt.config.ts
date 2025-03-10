import { resolve } from 'node:path'
import { commonAlias } from '../../packages/shared/node'
import { pwa } from './app/config/pwa'
import { appDescription } from './app/constants/index'

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
    'nuxt-monaco-editor',
  ],

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    // when using generate, payload js assets included in sw precache manifest
    // but missing on offline, disabling extraction it until fixed
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  compatibilityDate: '2024-08-14',

  css: [
    '@unocss/reset/tailwind.css',
  ],

  colorMode: {
    classSuffix: '',
    preference: 'dark',
    fallback: 'dark',
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
        // { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: appDescription },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      script: [
        // https://clarity.microsoft.com/
        {
          type: 'text/javascript',
          innerHTML: `(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "kq50mx5ttn");`,
        },
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

  vue: {
    compilerOptions: {
      isCustomElement: (tag: string) => {
        const customElements = [
          'model-viewer',
        ]
        return customElements.includes(tag)
      },
    },
    runtimeCompiler: true,
  },
})
