// custom
import './styles/vars.scss'
import './styles/index.scss'

import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
// import NotFound from './NotFound.vue'

import 'uno.css'

import 'vitepress-theme-you/css'
import YouTheme from 'vitepress-theme-you';

const theme: Theme = {
  Layout,
  NotFound: YouTheme.NotFound,
  enhanceApp: ({ app }) => {
    // if (typeof window !== 'undefined') import('./modules/pwa');
  },
};

export default theme
