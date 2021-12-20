import type { YouTheme } from 'vitepress-theme-you'
import { sidebar } from './sidebar'
import { nav } from './nav'

const themeConfig: YouTheme.Config = {
  // algolia: {
  //   appId: "",
  //   apiKey: "",
  //   indexName: "",
  // },
  iconClass: 'i-ri-video-chat-line',

  repo: 'YunYouJun/advjs',
  logo: '/favicon.svg',

  docsDir: 'docs',
  docsBranch: 'main',
  docsRepo: 'YunYouJun/advjs',

  editLinks: true,
  editLinkText: '✍️ 帮助改善此页面',
  lastUpdated: '🕙 上次更新',

  nav,
  sidebar,
}

export default themeConfig
