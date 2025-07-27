import type { initAdvData } from './data'

import { computed } from 'vue'
import { setupAdvContext } from '../setup/context'

export * from './data'
export { $t } from '@advjs/client/modules/i18n'

export function initAdvContext(advData: ReturnType<typeof initAdvData>) {
  const advConfig = computed(() => advData.value.config)
  const gameConfig = computed(() => advData.value.gameConfig)
  const themeConfig = computed(() => advData.value.config.themeConfig)

  const advContext = setupAdvContext({
    config: advConfig,
    gameConfig,
    themeConfig,
  })

  return advContext
}
