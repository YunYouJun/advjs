import type { UserModule } from './types'
import { createApp } from 'vue'
import App from './App.vue'

import { setupAdv } from './setup/adv'
import { setupMain } from './setup/main'

import { statement } from './utils/statement'

async function main() {
  const app = createApp(App)
  const { router } = await setupMain(app)
  const ctx = { app, isClient: typeof window !== 'undefined', router }

  /**
   * glob import all modules
   */
  Object.values(
    import.meta.glob<{ install: UserModule }>('./modules/*.ts', { eager: true }),
  ).map(i =>
    i.install?.(ctx),
  )

  /**
   * adv client ctx
   * after modules load (pinia, ...)
   */
  setupAdv(ctx)

  app.mount('#app')
    .$nextTick(() => {
      postMessage({ payload: 'removeLoading' }, '*')
    })

  statement()
}

main()
