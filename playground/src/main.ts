import type { UserModule } from './types'

import { setupLayouts } from 'virtual:generated-layouts'
import { ViteSSG } from 'vite-ssg'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'

import { install as installAdv } from './setup/adv'

// 引入组件库的少量全局样式变量
import 'tdesign-vue-next/es/style/index.css'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

import '@advjs/theme-pominis/styles'

// https://github.com/antfu/vite-ssg
export const createApp = ViteSSG(
  App,
  {
    routes: setupLayouts(routes),
    base: import.meta.env.BASE_URL,
  },
  (ctx) => {
    // install all modules under `modules/`
    Object.values(import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }))
      .forEach(i => i.install?.(ctx))
    // ctx.app.use(Previewer)

    installAdv(ctx)
  },
)
