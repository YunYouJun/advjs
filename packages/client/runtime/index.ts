import type { AdvConfig, AdvGameConfig, AdvThemeConfig } from '@advjs/types'
import { defaultAdvConfig } from '@advjs/core'
import { computed, ref } from 'vue'
import { setupAdvContext } from '../setup/context'

export const gameConfig = ref<AdvGameConfig>(defaultAdvConfig.gameConfig as AdvGameConfig)

export function initAdvContext() {
  const config = computed<AdvConfig>(() => {
    return {
      ...defaultAdvConfig,
      showCharacterAvatar: true,
    }
  })
  const themeConfig = computed<AdvThemeConfig>(() => defaultAdvConfig.themeConfig)

  const advContext = setupAdvContext({
    config,
    gameConfig: computed(() => gameConfig.value),
    themeConfig,
  })

  return advContext
}
