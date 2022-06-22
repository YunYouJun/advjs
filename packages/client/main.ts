import generatedRoutes from 'virtual:generated-pages'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { MotionPlugin } from '@vueuse/motion'
import { createHead } from '@vueuse/head'
import App from './App.vue'

// unocss
import '@unocss/reset/tailwind.css'
import 'uno.css'
// load client & theme styles
import '/@advjs/styles'

// animate
// unocss animate not work
import 'animate.css'

import { createAdv } from './setup'
import { statement } from './utils/statement'

const routes = setupLayouts(generatedRoutes)

const app = createApp(App)
app.use(createHead())
app.use(createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
}))

Object.values(import.meta.globEager('./modules/*.ts')).map(i =>
  i.install?.({ app }),
)

app.use(createAdv())

app.use(MotionPlugin)
app.mount('#app')

statement()
