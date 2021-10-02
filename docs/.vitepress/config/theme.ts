import type { DefaultTheme } from '../theme/config'
import { sidebar } from './sidebar'
import { nav } from './nav'

const themeConfig: DefaultTheme.Config = {
  // algolia: {
  //   appId: "",
  //   apiKey: "",
  //   indexName: "",
  // },
  repo: 'YunYouJun/element-theme-ink',
  logo: '/favicon.svg',
  docsDir: '.',
  docsBranch: 'main',
  docsRepo: 'YunYouJun/element-theme-ink',
  editLinks: true,
  editLinkText: '✍️ Suggest changes to this page',
  nav,
  sidebar,
}

export default themeConfig
