import type { Pinia } from 'pinia'
import type { AdvContext } from '../types'
import { $t } from '@advjs/client/modules/i18n'
import { watch } from 'vue'

import { useAdvAuto, useAdvBgm, useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import { useAdvCharacters } from '../composables/useAdvCharacters'
import { useAdvNodes } from '../composables/useAdvNodes'
import { initPixi } from '../pixi'
import { useAdvStore, useAudioStore } from '../stores'
import { ADV_RUNTIME, initGameRuntime } from '../utils'

/**
 * set adv context
 */
export function setupAdvContext(ctx: {
  config: AdvContext['config']
  gameConfig: AdvContext['gameConfig']
  themeConfig: AdvContext['themeConfig']
  pinia?: Pinia
}) {
  const store = useAdvStore(ctx.pinia)

  const advContext: AdvContext = {
    store,
    config: ctx.config,
    gameConfig: ctx.gameConfig,
    themeConfig: ctx.themeConfig,
    functions: {},

    init: async () => {
      advContext.runtime = await initGameRuntime(advContext)
      advContext.pixiGame = await initPixi(advContext)
    },

    $t,
    $nav: {} as ReturnType<typeof useAdvNav>,
    $logic: {} as ReturnType<typeof useAdvLogic>,
    $tachies: {} as ReturnType<typeof useAdvTachies>,
    $characters: {} as ReturnType<typeof useAdvCharacters>,
    $bgm: {} as ReturnType<typeof useAdvBgm>,
    $auto: {} as ReturnType<typeof useAdvAuto>,
    $nodes: {} as ReturnType<typeof useAdvNodes>,
    runtime: ADV_RUNTIME,
  }
  advContext.$nav = useAdvNav(advContext)
  advContext.$logic = useAdvLogic(advContext)
  advContext.$tachies = useAdvTachies(advContext)
  advContext.$characters = useAdvCharacters(advContext)
  advContext.$bgm = useAdvBgm(advContext)
  advContext.$auto = useAdvAuto(advContext)
  advContext.$nodes = useAdvNodes(advContext)

  // sync persisted bgm volume into the bgm composable (and keep them in sync)
  const audio = useAudioStore()
  advContext.$bgm.setVolume(audio.bgmVolume)
  watch(() => audio.bgmVolume, (v) => {
    advContext.$bgm.setVolume(v)
  })

  return advContext
}
