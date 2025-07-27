import type { AdvConfig, AdvGameConfig } from '@advjs/types'

import type { ComputedRef } from 'vue'
import type { useAdvBgm, useAdvLogic, useAdvNav, useAdvTachies } from '../composables'
import type { useAdvCharacters } from '../composables/useAdvCharacters'
import type { useAdvNodes } from '../composables/useAdvNodes'
import type { PixiGame } from '../pixi/game'
import type { AdvStore } from '../stores'
import type { ADV_RUNTIME } from '../utils'

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
  $characters: ReturnType<typeof useAdvCharacters>
  $bgm: ReturnType<typeof useAdvBgm>
  $nodes: ReturnType<typeof useAdvNodes>

  init: () => Promise<void>
  /**
   * 运行时变量
   */
  runtime: typeof ADV_RUNTIME
  pixiGame?: PixiGame
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
