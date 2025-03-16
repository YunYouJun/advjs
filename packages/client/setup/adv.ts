import type { AdvContext, UserModule } from '~/types'
import setups from '#advjs/setups/adv'
import { advConfigSymbol, advDataSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { computed } from 'vue'

import { injectionAdvContext } from '../constants'
import { initAdvData } from '../data'

import { useAdvStore } from '../stores'

export const setupAdv: UserModule = async ({ app, router }) => {
  // inject adv config before modules
  // const advConfig = initAdvConfig()
  const advData = initAdvData()
  const advConfig = computed(() => advData.value.config)
  const gameConfig = computed(() => advData.value.gameConfig)
  const themeConfig = computed(() => advData.value.config.themeConfig)

  app.provide(advDataSymbol, advData)

  app.provide(advConfigSymbol, advConfig)
  app.provide(gameConfigSymbol, gameConfig)
  app.provide(themeConfigSymbol, themeConfig)

  const store = useAdvStore()
  const advContext: AdvContext = {
    store,
    config: advConfig,
    gameConfig,
    themeConfig,
    functions: {},
    nav: {},
  }

  Object.defineProperties(app.config.globalProperties, {
    $adv: {
      get() {
        return advContext
      },
    },
  })

  // handler HMR when router is ready
  app.provide(injectionAdvContext, advContext)

  for (const setup of setups)
    await setup({ app, router, $adv: advContext })
}
