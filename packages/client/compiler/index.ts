import type { initAdvData } from './data'

import { computed } from 'vue'
import configuredRuntimePlugins from '#advjs/runtime-plugins'
import { setupAdvContext } from '../setup/context'

export { $t } from '../modules/i18n'
export * from './data'

export function initAdvContext(advData: ReturnType<typeof initAdvData>) {
  const advConfig = computed(() => advData.value.config)
  const gameConfig = computed(() => advData.value.gameConfig)
  const themeConfig = computed(() => advData.value.config.themeConfig)

  const advContext = setupAdvContext({
    config: advConfig,
    gameConfig,
    themeConfig,
    runtimePlugins: configuredRuntimePlugins,
  })

  return advContext
}
