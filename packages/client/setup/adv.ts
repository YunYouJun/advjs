import type { UserModule } from '~/types'
import { advDataSymbol, appConfigSymbol, themeConfigSymbol } from '@advjs/core'
import { computed, reactive } from 'vue'
import { injectionAdvContext } from '../constants'

import { initAdvData } from '../data'
// import { advConfig } from '../env'
import { useAdvStore } from '../stores'

export const setupAdv: UserModule = ({ app }) => {
  // inject adv config before modules
  // const advConfig = initAdvConfig()
  const advData = initAdvData()
  const themeConfig = computed(() => advData.value.config.themeConfig)

  app.provide(advDataSymbol, advData)
  app.provide(appConfigSymbol, computed(() => advData.value.config))
  app.provide(themeConfigSymbol, themeConfig)

  // handler HMR when router is ready
  const store = useAdvStore()
  app.provide(injectionAdvContext, reactive({
    store,
    config: advData.value.config,
    themeConfig,
    functions: {},
    nav: {},
  }))
}
