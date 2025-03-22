import type { AdvConfig, AdvGameConfig, Tachie } from '@advjs/types'

import type { ComputedRef } from 'vue'
import type { useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
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
  /**
   * 立绘数据
   */
  tachies: ComputedRef<Map<string, Tachie>>

  $nav: ReturnType<typeof useAdvNav>
  $logic: ReturnType<typeof useAdvLogic>
  $tachies: ReturnType<typeof useAdvTachies>

  init: () => Promise<void>
  pixiGame?: PixiGame
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
