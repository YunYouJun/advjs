import type { AdvConfig } from '@advjs/types'

import type { UserModule } from '~/types'
import { injectionAdvContext } from '@advjs/client'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { initAdvContext } from '../../../packages/client/runtime'

const customAdvConfig: Partial<AdvConfig> = {
  showCharacterAvatar: true,
  cdn: {
    enable: true,
    prefix: 'https://cdn.pominis.com',
  },
}

export const install: UserModule = ({ app }) => {
  const advData = ref({
    config: customAdvConfig,
  })

  const advContext = initAdvContext(advData)
  app.provide(injectionAdvContext, advContext)
  app.provide(advConfigSymbol, advContext.config || {})
  app.provide(gameConfigSymbol, advContext.gameConfig)
  app.provide(themeConfigSymbol, advContext.themeConfig)
}
