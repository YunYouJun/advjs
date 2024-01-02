import 'uno.css'

import { h } from 'vue'
import Theme from 'vitepress/theme'

// custom
import './styles/vars.scss'
import './styles/index.scss'

import HomePage from '../components/HomePage.vue'

import '../../../packages/gui/src/styles/index.scss'

import { mountCssVarsRootStyle } from '../../../packages/gui/src/styles/icons'

export default {
  ...Theme,
  Layout() {
    mountCssVarsRootStyle()

    return h(Theme.Layout, null, {
      'home-hero-before': () => h(HomePage),
    })
  },
}
