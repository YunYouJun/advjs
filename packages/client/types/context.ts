import type { CompileDiagnostic } from '@advjs/core'
import type { AdvConfig, AdvGameConfig, AdvGameExtraItem, JsonObject, RuntimeProgram } from '@advjs/types'

import type { ComputedRef, ShallowRef } from 'vue'
import type { useAdvAudio, useAdvAuto, useAdvTachies } from '../composables'
import type { useAdvCharacters } from '../composables/useAdvCharacters'
import type { AdvRuntimeHost } from '../composables/useAdvRuntime'
import type { AdvTranslation } from '../modules/i18n'
import type { PixiGame } from '../pixi/game'
import type { RuntimeExtrasController } from '../runtime/extras'
import type { RuntimeGalleryController } from '../runtime/gallery'
import type { RuntimeProgressionController } from '../runtime/progression'
import type { RuntimeReadLogController } from '../runtime/read-log'
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

  $t: AdvTranslation
  $tachies: ReturnType<typeof useAdvTachies>
  $characters: ReturnType<typeof useAdvCharacters>
  $audio: ReturnType<typeof useAdvAudio>
  $auto: ReturnType<typeof useAdvAuto>

  /**
   * A host may cancel a pending preview without installing an obsolete program.
   * `persistence: false` detaches browser progression, gallery and extras (draft previews).
   * `isolated: true` keeps them readable but uses memory saves and writes none of them
   * (scene replay). `variables` override the configured initial variables.
   * `compiledProgram` lets a host install a program it already compiled.
   */
  init: (options?: {
    isCurrent?: () => boolean
    persistence?: boolean
    isolated?: boolean
    variables?: JsonObject
    compiledProgram?: RuntimeProgram
  }) => Promise<void>
  /** The installed program, or a compiled one without starting a session (extras screens). */
  loadProgram: () => Promise<RuntimeProgram | undefined>
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
  /** Optional host-owned variables persisted across new runtime sessions. */
  progression?: RuntimeProgressionController
  /** Optional host-owned CG unlock collection. */
  gallery?: RuntimeGalleryController
  /** Optional host-owned record behind endings, achievements, replays, music room and route chart. */
  extras?: RuntimeExtrasController
  /** Achievements unlocked during this page session, waiting for the toast. */
  extrasNotices: ShallowRef<AdvGameExtraItem[]>
  /** Read nodes and taken choices across playthroughs of the installed program. */
  readLog?: RuntimeReadLogController
  /** Advance the active text view using the same action as a click. */
  advanceHandler?: () => unknown
  pixiGame?: PixiGame
}

export interface AdvOptions {
  /**
   * 调试模式
   */
  debug?: boolean
}
