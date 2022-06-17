import 'uno.css'

import { h } from 'vue'
import Theme from 'vitepress/theme'

// custom
import './styles/vars.scss'
import './styles/index.scss'

import HomePage from '../components/HomePage.vue'

export default {
  ...Theme,
  Layout() {
    return h(Theme.Layout, null, {
      'home-hero-before': () => h(HomePage),
    })
  },
}
