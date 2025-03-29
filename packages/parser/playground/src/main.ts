import type { UserModule } from './types'
import { createHead } from '@unhead/vue/client'
import { setupLayouts } from 'virtual:generated-layouts'
import { createApp } from 'vue'

import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'

import App from './App.vue'

import '@unocss/reset/tailwind.css'
// your custom styles here
import './styles/index.css'

import 'uno.css'
import 'wc-github-corners'

const router = createRouter({
  history: createWebHashHistory(),
  routes: setupLayouts(routes),
})

const app = createApp(App)
const head = createHead()
app.use(router)
app.use(head)
Object.values(import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true })).map(i =>
  i.install?.({ app, isClient: typeof window !== 'undefined', router }),
)
app.mount('#app')
