import type { AdvContext, UserModule } from '~/types'
import setups from '#advjs/setups/adv'
import { advConfigSymbol, advDataSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { consola, LogLevels } from 'consola'
import { computed } from 'vue'

import { $t, initAdvData } from '../compiler'

import { useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import { injectionAdvContext } from '../constants'
import { initPixi } from '../pixi'
import { useAdvStore } from '../stores'

export function initAdvContext(advData: ReturnType<typeof initAdvData>) {
  const advConfig = computed(() => advData.value.config)
  const gameConfig = computed(() => advData.value.gameConfig)
  const themeConfig = computed(() => advData.value.config.themeConfig)

  const store = useAdvStore()

  const advContext: AdvContext = {
    store,
    config: advConfig,
    gameConfig,
    themeConfig,
    functions: {},

    init: async () => {
      advContext.pixiGame = await initPixi(advContext)
    },

    $t,
    $nav: {} as ReturnType<typeof useAdvNav>,
    $logic: {} as ReturnType<typeof useAdvLogic>,
    $tachies: {} as ReturnType<typeof useAdvTachies>,
  }
  advContext.$nav = useAdvNav(advContext)
  advContext.$logic = useAdvLogic(advContext)
  advContext.$tachies = useAdvTachies(advContext)

  return advContext
}

export const setupAdv: UserModule = async ({ app, router }) => {
  // inject adv config before modules
  // const advConfig = initAdvConfig()
  const advData = initAdvData()
  app.provide(advDataSymbol, advData)

  const advContext = initAdvContext(advData)
  app.provide(advConfigSymbol, advContext.config)
  app.provide(gameConfigSymbol, advContext.gameConfig)
  app.provide(themeConfigSymbol, advContext.themeConfig)

  Object.defineProperties(app.config.globalProperties, {
    $adv: {
      get() {
        return advContext
      },
    },
  })

  // handler HMR when router is ready
  app.provide(injectionAdvContext, advContext)

  /**
   * debug
   */
  consola.level = advContext.config.value.logLevel || LogLevels.info

  for (const setup of setups)
    await setup({ app, router, $adv: advContext })
}
