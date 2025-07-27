import type { UserModule } from '~/types'

import { injectionAdvContext, statement } from '@advjs/client'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { initAdvContext } from '../../../packages/client/runtime'

export const install: UserModule = ({ app }) => {
  const advContext = initAdvContext()
  app.provide(injectionAdvContext, advContext)
  app.provide(advConfigSymbol, advContext.config || {})
  app.provide(gameConfigSymbol, advContext.gameConfig)
  app.provide(themeConfigSymbol, advContext.themeConfig)

  statement()
}
