// custom
import './styles/vars.scss'
import './styles/index.scss'

import type { Theme } from 'vitepress'
import CustomLayout from './Layout.vue'

import 'uno.css'

import { VPTheme } from 'vitepress-theme-you';

const theme: Theme = Object.assign({}, VPTheme, {
  Layout: CustomLayout,
  NotFound: VPTheme.NotFound,
  enhanceApp: ({ app }) => {
    // if (typeof window !== 'undefined') import('./modules/pwa');
  },
} as Theme)

export default theme
