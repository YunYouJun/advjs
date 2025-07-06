import Theme from 'vitepress/theme'

import { h } from 'vue'
import { mountCssVarsRootStyle } from '../../../packages/gui/client/styles/icons'

import HomePage from './components/HomePage.vue'
import 'uno.css'
import 'virtual:group-icons.css'

// custom
import './styles/vars.scss'

import './styles/index.scss'
import '../../../packages/gui/client/styles/index.scss'

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
