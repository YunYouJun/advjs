import type { UserModule } from '~/types'

import { injectionAdvContext } from '../../../packages/client/constants'
import { initAdvContext } from '../../../packages/client/runtime'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '../../../packages/core/src'

export const install: UserModule = ({ app }) => {
  const advContext = initAdvContext()
  app.provide(injectionAdvContext, advContext)
  app.provide(advConfigSymbol, advContext.config || {})
  app.provide(gameConfigSymbol, advContext.gameConfig)
  app.provide(themeConfigSymbol, advContext.themeConfig)
}
