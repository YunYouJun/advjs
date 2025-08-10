import type { AdvConfig, AdvGameConfig, AdvThemeConfig } from '@advjs/types'
import type { Ref } from 'vue'
import { defaultAdvConfig } from 'advjs'
import { computed, ref } from 'vue'
import { setupAdvContext } from '../setup/context'

export const gameConfig = ref<AdvGameConfig>(defaultAdvConfig.gameConfig as AdvGameConfig)

export function initAdvContext(advData: Ref<{
  config: Partial<AdvConfig>
}>) {
  const config = computed<AdvConfig>(() => {
    return {
      ...defaultAdvConfig,
      ...advData.value.config,
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
