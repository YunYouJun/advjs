import type { UserModule } from '~/types'
import { advConfigSymbol, appConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { initAdvConfig, initAppConfig, initThemeConfig } from '../../config'

export const install: UserModule = ({ app }) => {
  // inject adv config before modules
  const advConfig = initAdvConfig()
  const appConfig = initAppConfig()
  const themeConfig = initThemeConfig()

  app.provide(advConfigSymbol, advConfig)
  app.provide(appConfigSymbol, appConfig)
  app.provide(themeConfigSymbol, themeConfig)

  // handler HMR when router is ready
}

export * from './context'
export * from './logic'
export * from './store'
