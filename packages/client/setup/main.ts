import type { App } from 'vue'
import setups from '#advjs/setups/main'

import { createHead } from '@unhead/vue/client'
import { MotionPlugin } from '@vueuse/motion'
import { setupLayouts } from 'virtual:generated-layouts'

import { createRouter, createWebHashHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
// unocss
import '@unocss/reset/tailwind.css'
import 'uno.css'
// load client & theme styles
import '#advjs/styles'

// animate
// unocss animate not work
import 'animate.css'

/**
 * configure vue app
 * @param app
 */
export async function setupMain(app: App) {
  const router = createRouter({
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes: setupLayouts(routes),
  })

  app.use(createHead())
  app.use(router)
  app.use(MotionPlugin)

  for (const setup of setups)
    await setup({ app, router })

  return {
    app,
    router,
  }
}
