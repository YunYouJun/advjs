import 'uno.css'

import { h } from 'vue'
import Theme from 'vitepress/theme'

// custom
import './styles/vars.scss'
import './styles/index.scss'

import HomePage from '../components/HomePage.vue'

import '../../../packages/gui/client/styles/index.scss'
import { mountCssVarsRootStyle } from '../../../packages/gui/client/styles/icons'

export default {
  ...Theme,
  Layout() {
    if (typeof document !== 'undefined')
      mountCssVarsRootStyle()

    return h(Theme.Layout, null, {
      'home-hero-before': () => h(HomePage),
    })
  },
}
