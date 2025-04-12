import type { AdvConfig, AdvGameConfig, AdvThemeConfig } from '@advjs/types'
import type { AdvContext } from '../types'
import { defaultConfig } from '@advjs/core'
import { computed, ref } from 'vue'
import { useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import { initPixi } from '../pixi'
import { useAdvStore } from '../stores'

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
      advContext.pixiGame = await initPixi(advContext)
    },

    $t: (key: string) => key,
    $nav: {} as ReturnType<typeof useAdvNav>,
    $logic: {} as ReturnType<typeof useAdvLogic>,
    $tachies: {} as ReturnType<typeof useAdvTachies>,
  }

  advContext.$nav = useAdvNav(advContext)
  advContext.$logic = useAdvLogic(advContext)
  advContext.$tachies = useAdvTachies(advContext)

  return advContext
}
