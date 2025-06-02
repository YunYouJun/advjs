import type { AdvContext } from '../types'
import type { initAdvData } from './data'
import { $t } from '@advjs/client/modules/i18n'

import { computed } from 'vue'
import { useAdvBgm, useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import { initPixi } from '../pixi'
import { useAdvStore } from '../stores'
import { ADV_RUNTIME, initGameRuntime } from '../utils'

export * from './data'
export { $t } from '@advjs/client/modules/i18n'

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
      advContext.runtime = await initGameRuntime(advContext)
      advContext.pixiGame = await initPixi(advContext)
    },

    $t,
    $nav: {} as ReturnType<typeof useAdvNav>,
    $logic: {} as ReturnType<typeof useAdvLogic>,
    $tachies: {} as ReturnType<typeof useAdvTachies>,
    $bgm: {} as ReturnType<typeof useAdvBgm>,
    runtime: ADV_RUNTIME,
  }
  advContext.$nav = useAdvNav(advContext)
  advContext.$logic = useAdvLogic(advContext)
  advContext.$tachies = useAdvTachies(advContext)
  advContext.$bgm = useAdvBgm(advContext)

  return advContext
}
