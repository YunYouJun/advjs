import type { UserModule } from '@advjs/client/types'
import setups from '#advjs/setups/adv'
import { advConfigSymbol, advDataSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { consola, LogLevels } from 'consola'

import { initAdvContext, initAdvData } from '../compiler'

import { injectionAdvContext } from '../constants'

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
