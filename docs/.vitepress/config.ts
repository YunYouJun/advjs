import { defineConfig } from 'vitepress'
// import type { DefaultTheme, UserConfig } from 'vitepress'

// import { VitePWA } from 'vite-plugin-pwa'

import head from './config/head'
import { metaData } from './config/constants'

import { sidebar } from './config/sidebar'
import { nav } from './config/nav'

export default defineConfig({
  ...metaData,

  head,

  // todo
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
      pattern: 'https://github.com/YunYouJun/advjs/edit/main/docs/:path',
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

    footer: {
      copyright: 'Copyright © 2021-PRESENT YunYouJun',
    },

    nav,
    sidebar,
  },

  srcExclude: ['README.md'],
})
