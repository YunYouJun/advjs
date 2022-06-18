import generatedRoutes from 'virtual:generated-pages'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { MotionPlugin } from '@vueuse/motion'
import { createHead } from '@vueuse/head'
import App from './App.vue'

// windicss layers
import 'virtual:windi-base.css'
import 'virtual:windi-components.css'

// your custom styles here
import '@advjs/client/styles/vars.scss'
// load client & theme styles
import '/@advjs/styles'
import '@advjs/client/styles/index.scss'

// windicss utilities should be the last style import
import 'virtual:windi-utilities.css'
// windicss devtools support (dev only)
import 'virtual:windi-devtools'
import { createAdv } from './setup'

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
