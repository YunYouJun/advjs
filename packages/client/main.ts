import generatedRoutes from 'virtual:generated-pages'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { MotionPlugin } from '@vueuse/motion'
import { createHead } from '@unhead/vue'
import App from './App.vue'

// unocss
import '@unocss/reset/tailwind.css'
import 'uno.css'

// load client & theme styles
import '/@advjs/styles'

// animate
// unocss animate not work
import 'animate.css'

import { createAdvVuePlugin, install as installAdv } from './setup'
import { statement } from './utils/statement'
import type { UserModule } from './types'

const routes = setupLayouts(generatedRoutes)
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

const app = createApp(App)
app.use(createHead())
app.use(router)

const ctx = { app, isClient: typeof window !== 'undefined', router }
installAdv(ctx)

Object.values(
  import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }),
).map(i =>
  i.install?.(ctx),
)

app.use(createAdvVuePlugin())

app.use(MotionPlugin)
app.mount('#app')

statement()
