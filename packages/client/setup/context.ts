import type { CompileDiagnostic } from '@advjs/core'
import type { RuntimeProgram } from '@advjs/types'
import type { Pinia } from 'pinia'
import type { CompileClientRuntimeProgramOptions } from '../runtime'
import type { AdvClientRuntimePlugin, AdvContext } from '../types'
import { $t } from '@advjs/client/modules/i18n'
import { shallowRef, watch } from 'vue'
import { useAdvAuto, useAdvBgm, useAdvTachies } from '../composables'
import { useAdvCharacters } from '../composables/useAdvCharacters'
import { createAdvRuntimeHost } from '../composables/useAdvRuntime'
import { initPixi } from '../pixi'
import {
  applyRuntimePresentationEffects,
  compileClientRuntimeProgram,
  createActivityRendererRegistry,
  createBrowserRuntimeProgression,
  syncRuntimePresentation,
} from '../runtime'
import { useAdvStore, useAudioStore } from '../stores'
import { ADV_RUNTIME, initGameRuntime } from '../utils'

const BOOTSTRAP_PROGRAM: RuntimeProgram = {
  schemaVersion: 1,
  id: 'advjs:bootstrap',
  hash: 'advjs:bootstrap',
  entry: { chapterId: 'bootstrap', nodeId: 'end' },
  requiredPlugins: {},
  chapters: {
    bootstrap: {
      id: 'bootstrap',
      entry: 'end',
      order: ['end'],
      nodes: { end: { id: 'end', kind: 'end' } },
    },
  },
}

function compilerError(diagnostics: Array<{ code: string, message: string }>): Error {
  return new Error(diagnostics.map(item => `${item.code}: ${item.message}`).join('\n'))
}

function runtimePlugins(value: unknown): AdvClientRuntimePlugin[] {
  if (!Array.isArray(value))
    return []
  return value.filter((plugin): plugin is AdvClientRuntimePlugin => Boolean(
    plugin
    && typeof plugin === 'object'
    && typeof (plugin as AdvClientRuntimePlugin).name === 'string'
    && typeof (plugin as AdvClientRuntimePlugin).version === 'string',
  ))
}

export function setupAdvContext(ctx: {
  config: AdvContext['config']
  gameConfig: AdvContext['gameConfig']
  themeConfig: AdvContext['themeConfig']
  pinia?: Pinia
  fetcher?: CompileClientRuntimeProgramOptions['fetcher']
  runtimePlugins?: unknown
  progressionStorage?: Storage | false
}) {
  const store = useAdvStore(ctx.pinia)
  const plugins = runtimePlugins(ctx.runtimePlugins)
  const activityRenderers = createActivityRendererRegistry(plugins)
  const compileDiagnostics = shallowRef<CompileDiagnostic[]>([])
  let advContext: AdvContext

  const runtime = createAdvRuntimeHost({
    program: BOOTSTRAP_PROGRAM,
    plugins,
    onState(state, current, program) {
      store.$syncRuntime(state, current, program)
      syncRuntimePresentation(state, ctx.gameConfig.value, ADV_RUNTIME)
      if (advContext?.progression) {
        try {
          advContext.progression.capture(state.variables)
        }
        catch (error) {
          console.warn('[advjs] Failed to persist meta progression', error)
        }
      }
    },
    onEffects(effects) {
      if (advContext)
        applyRuntimePresentationEffects(effects, advContext.$bgm)
    },
  })

  advContext = {
    store,
    config: ctx.config,
    gameConfig: ctx.gameConfig,
    themeConfig: ctx.themeConfig,
    functions: {},
    runtime,
    compileDiagnostics,
    activityRenderers,
    resources: ADV_RUNTIME,

    async init() {
      compileDiagnostics.value = []
      await initGameRuntime(advContext)
      const result = await compileClientRuntimeProgram({
        id: `adv-browser:${ctx.gameConfig.value.title || 'game'}`,
        chapters: ctx.gameConfig.value.chapters,
        fetcher: ctx.fetcher,
        requiredPlugins: ctx.gameConfig.value.requiredPlugins,
      })
      compileDiagnostics.value = structuredClone(result.diagnostics)
      if (!result.program)
        throw compilerError(result.diagnostics)

      const progressionConfig = ctx.gameConfig.value.progression
      const progressionStorage = ctx.progressionStorage === false
        ? undefined
        : ctx.progressionStorage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
      advContext.progression = progressionConfig && progressionStorage
        ? createBrowserRuntimeProgression(progressionConfig, { storage: progressionStorage })
        : undefined
      const initialVariables = advContext.progression
        ? advContext.progression.restore(ctx.gameConfig.value.variables ?? {})
        : ctx.gameConfig.value.variables
      runtime.install(result.program, {
        initialVariables,
      })
      advContext.pixiGame = await initPixi(advContext)
    },

    $t,
    $tachies: undefined as never,
    $characters: undefined as never,
    $bgm: undefined as never,
    $auto: undefined as never,
  }
  advContext.$tachies = useAdvTachies(advContext)
  advContext.$characters = useAdvCharacters(advContext)
  advContext.$bgm = useAdvBgm(advContext)
  advContext.$auto = useAdvAuto(advContext)

  const audio = useAudioStore()
  advContext.$bgm.setVolume(audio.bgmVolume)
  watch(() => audio.bgmVolume, value => advContext.$bgm.setVolume(value))

  return advContext
}
