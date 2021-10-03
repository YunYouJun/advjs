// windicss layers
import 'virtual:windi-base.css'
import 'virtual:windi-components.css'

import 'vitepress/dist/client/theme-default/styles/vars.css'
import 'vitepress/dist/client/theme-default/styles/layout.css'
import 'vitepress/dist/client/theme-default/styles/code.css'
import 'vitepress/dist/client/theme-default/styles/custom-blocks.css'
import 'vitepress/dist/client/theme-default/styles/sidebar-links.css'

import './styles/vars.scss'
import './styles/index.scss'

// windicss utilities should be the last style import
import 'virtual:windi-utilities.css'
// windicss devtools support (dev only)
import 'virtual:windi-devtools'

import { Theme } from 'vitepress'
// import Layout from 'vitepress/dist/client/theme-default/Layout.vue'
import NotFound from 'vitepress/dist/client/theme-default/NotFound.vue'
import Layout from './Layout.vue'

if (typeof window !== 'undefined') import('./modules/pwa')

const theme: Theme = {
  Layout,
  NotFound,
  enhanceApp: ({ app }) => {},
}

export default theme
