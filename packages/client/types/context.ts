import type { CompileDiagnostic } from '@advjs/core'
import type { AdvConfig, AdvGameConfig } from '@advjs/types'

import type { ComputedRef, ShallowRef } from 'vue'
import type { useAdvAuto, useAdvBgm, useAdvTachies } from '../composables'
import type { useAdvCharacters } from '../composables/useAdvCharacters'
import type { AdvRuntimeHost } from '../composables/useAdvRuntime'
import type { PixiGame } from '../pixi/game'
import type { AdvStore } from '../stores'
import type { ADV_RUNTIME } from '../utils'
import type { ActivityRendererRegistry } from './activity'

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
  $tachies: ReturnType<typeof useAdvTachies>
  $characters: ReturnType<typeof useAdvCharacters>
  $bgm: ReturnType<typeof useAdvBgm>
  $auto: ReturnType<typeof useAdvAuto>

  init: () => Promise<void>
  /**
   * 运行时变量
   */
  runtime: AdvRuntimeHost
  /** Diagnostics produced by the most recent runtime compilation. */
  compileDiagnostics: ShallowRef<CompileDiagnostic[]>
  /** Presentation-only renderers registered by client runtime plugins. */
  activityRenderers: ActivityRendererRegistry
  /** Presentation-only character and tachie resources. */
  resources: typeof ADV_RUNTIME
  pixiGame?: PixiGame
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
