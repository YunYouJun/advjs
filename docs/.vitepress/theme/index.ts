import type { EnhanceAppContext } from 'vitepress'
import Theme from 'vitepress/theme'

import { h } from 'vue'
import { mountCssVarsRootStyle } from '../../../packages/gui/client/styles/icons'
import FeatureStatus from './components/FeatureStatus.vue'

import 'uno.css'
import 'virtual:group-icons.css'

// custom
import './styles/vars.scss'

import './styles/index.scss'
import './styles/docs.scss'
import './styles/home.scss'
import './styles/skins.scss'
import './styles/skin-transitions.scss'
import '../../../packages/gui/client/styles/index.scss'

export default {
  ...Theme,
  enhanceApp(ctx: EnhanceAppContext) {
    Theme.enhanceApp?.(ctx)
    // `<FeatureStatus id="…" />` in any Markdown page tags an unfinished feature.
    ctx.app.component('FeatureStatus', FeatureStatus)
  },
  Layout() {
    if (typeof document !== 'undefined')
      mountCssVarsRootStyle()

    return h(Theme.Layout)
  },
}
