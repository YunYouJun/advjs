import type { AdvConfig, AdvGameConfig } from '@advjs/types'

import type { UserModule } from '~/types'
import { injectionAdvContext, setupAdvContext } from '@advjs/client'
import { advConfigSymbol, gameConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { defaultAdvConfig, defaultGameConfig } from 'advjs'

const customAdvConfig: Partial<AdvConfig> = {
  showCharacterAvatar: true,
  cdn: {
    enable: true,
    prefix: 'https://cdn.pominis.com',
  },
  gameConfig: {
    bgm: {
      autoplay: true,
      library: 'https://cdn.pominis.com/bgms/bgm-library.json',
    },
  },
}

export const gameConfig = ref<AdvGameConfig>({
  ...defaultGameConfig,
  ...customAdvConfig.gameConfig,
  bgm: {
    ...defaultGameConfig.bgm,
    ...customAdvConfig.gameConfig?.bgm,
  },
})

export const install: UserModule = ({ app }) => {
  const config = computed<AdvConfig>(() => ({
    ...defaultAdvConfig,
    ...customAdvConfig,
    gameConfig: gameConfig.value,
  }))

  const advContext = setupAdvContext({
    config,
    gameConfig: computed(() => gameConfig.value),
    themeConfig: computed(() => config.value.themeConfig),
  })
  app.provide(injectionAdvContext, advContext)
  app.provide(advConfigSymbol, advContext.config)
  app.provide(gameConfigSymbol, advContext.gameConfig)
  app.provide(themeConfigSymbol, advContext.themeConfig)
}
