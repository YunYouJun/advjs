import 'windi-base.css'
import 'windi-components.css'

import 'vitepress/dist/client/theme-default/styles/vars.css'
import 'vitepress/dist/client/theme-default/styles/layout.css'
import 'vitepress/dist/client/theme-default/styles/code.css'
import 'vitepress/dist/client/theme-default/styles/custom-blocks.css'
import 'vitepress/dist/client/theme-default/styles/sidebar-links.css'

import './styles/vars.scss'
import './styles/index.scss'

import 'windi-utilities.css'

import { Theme } from 'vitepress'
// import Layout from 'vitepress/dist/client/theme-default/Layout.vue'
import NotFound from 'vitepress/dist/client/theme-default/NotFound.vue'
import Layout from './Layout.vue'

const theme: Theme = {
  Layout,
  NotFound,
  enhanceApp: ({ app }) => {},
}

export default theme
