// custom
import './styles/vars.scss'
import './styles/index.scss'

import type { Theme } from 'vitepress'
import { VPTheme } from 'vitepress-theme-you'
import CustomLayout from './Layout.vue'

import 'uno.css'

const theme: Theme = Object.assign({}, VPTheme, {
  Layout: CustomLayout,
  NotFound: VPTheme.NotFound,
  // enhanceApp: () => {
  //   if (typeof window !== 'undefined') import('./modules/pwa');
  // },
} as Theme)

export default theme
