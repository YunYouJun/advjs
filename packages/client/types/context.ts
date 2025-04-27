import type { AdvConfig, AdvGameConfig } from '@advjs/types'

import type { ComputedRef } from 'vue'
import type { useAdvBgm, useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import type { PixiGame } from '../pixi/game'
import type { AdvStore } from '../stores'

/**
 * start with $ means it's a system functions
 */
export interface AdvContext {
  store: AdvStore
  config: ComputedRef<AdvConfig>
  gameConfig: ComputedRef<AdvGameConfig>
  themeConfig: ComputedRef<AdvConfig['themeConfig']>
  functions: Record<string, () => void>

  $t: typeof import('../compiler').$t
  $nav: ReturnType<typeof useAdvNav>
  $logic: ReturnType<typeof useAdvLogic>
  $tachies: ReturnType<typeof useAdvTachies>
  $bgm: ReturnType<typeof useAdvBgm>

  init: () => Promise<void>
  pixiGame?: PixiGame
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
