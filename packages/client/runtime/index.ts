import type { AdvConfig, AdvGameConfig, AdvThemeConfig } from '@advjs/types'
import type { AdvContext } from '../types'
import { defaultConfig } from '@advjs/core'
import { computed, ref } from 'vue'
import { useAdvBgm, useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import { initPixi } from '../pixi'
import { useAdvStore } from '../stores'
import { ADV_RUNTIME, initGameRuntime } from '../utils'

export const gameConfig = ref<AdvGameConfig>(defaultConfig.gameConfig as AdvGameConfig)

export function initAdvContext() {
  const store = useAdvStore()

  const config = computed<AdvConfig>(() => {
    return {
      ...defaultConfig,
      showCharacterAvatar: true,
    }
  })
  const themeConfig = computed<AdvThemeConfig>(() => defaultConfig.themeConfig)

  const advContext: AdvContext = {
    config,
    gameConfig: computed(() => gameConfig.value),
    themeConfig,
    store,
    functions: {},

    async init() {
      advContext.runtime = await initGameRuntime(advContext)
      advContext.pixiGame = await initPixi(advContext)
    },

    $t: (key: string) => key,
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
