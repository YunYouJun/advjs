import generatedRoutes from 'virtual:generated-pages'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createHead } from '@vueuse/head'

import { createApp } from 'vue'
import App from './App.vue'

// windicss layers
import 'virtual:windi-base.css'
import 'virtual:windi-components.css'

// your custom styles here
import './styles/index.css'

// windicss utilities should be the last style import
import 'virtual:windi-utilities.css'
// windicss devtools support (dev only)
import 'virtual:windi-devtools'

const routes = generatedRoutes
const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
const head = createHead()
app.use(router)
app.use(head)
Object.values(import.meta.globEager('./modules/*.ts')).map(i =>
  i.install?.({ app, isClient: typeof window !== 'undefined', router }),
)
app.mount('#app')
