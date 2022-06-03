import path from 'path'
// import type { YouTheme } from 'vitepress-theme-you'
// import type { UserConfig } from 'vitepress'
import { defineConfig } from 'vitepress'

import Components from 'unplugin-vue-components/vite'
// import { VitePWA } from 'vite-plugin-pwa'

// @ts-expect-error config type
import baseConfig from 'vitepress-theme-you/config'
import head from './config/head'
import { metaData } from './config/constants'

import { sidebar } from './config/sidebar'
import { nav } from './config/nav'

export default defineConfig({
  extends: baseConfig,

  vite: {
    resolve: {
      alias: {
        '@/': `${path.resolve(__dirname, 'theme')}/`,
        'advjs/': `${path.resolve(__dirname, '../../packages/advjs/src')}/`,
      },
    },
    plugins: [
      Components({
        dirs: [path.resolve(__dirname, './theme/components')],
        extensions: ['vue', 'ts'],
        include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
        dts: true,
      }),

      // https://github.com/antfu/vite-plugin-pwa
      // VitePWA({
      //   registerType: 'autoUpdate',
      //   includeAssets: ['favicon.svg', 'robots.txt', 'safari-pinned-tab.svg'],
      //   manifest: {
      //     name: 'ADV.JS',
      //     short_name: 'ADV',
      //     theme_color: '#000',
      //   },
      // }),
    ],

    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: ['..'],
      },
    },
  },

  ...metaData,

  head,

  // algolia: {
  //   appId: "",
  //   apiKey: "",
  //   indexName: "",
  // },
  // iconClass: 'i-ri-video-chat-line',

  lastUpdated: true,

  themeConfig: {
    logo: '/favicon.svg',

    editLink: {
      repo: 'YunYouJun/advjs',
      branch: 'main',
      dir: 'docs',
      text: '✍️ 帮助改善此页面',
    },

    socialLinks: [
      {
        icon: 'github', link: 'https://github.com/YunYouJun/advjs',
      },
      {
        icon: 'twitter', link: 'https://twitter.com/YunYouJun',
      },
      {
        icon: 'discord', link: 'https://discord.gg/HNNPywcTxw',
      },
    ],

    nav,
    sidebar,
  },

  srcExclude: ['README.md'],
})
