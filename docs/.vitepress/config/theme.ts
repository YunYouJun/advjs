import type { DefaultTheme } from '../theme/config'
import { sidebar } from './sidebar'
import { nav } from './nav'

const themeConfig: DefaultTheme.Config = {
  // algolia: {
  //   appId: "",
  //   apiKey: "",
  //   indexName: "",
  // },
  repo: 'YunYouJun/advjs',
  logo: '/favicon.svg',

  docsDir: 'docs',
  docsBranch: 'main',
  docsRepo: 'YunYouJun/advjs',

  editLinks: true,
  editLinkText: '✍️ Suggest changes to this page',
  nav,
  sidebar,
}

export default themeConfig
