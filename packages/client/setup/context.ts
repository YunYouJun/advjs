import type { AdvRuntimePlugin } from '@advjs/core'
import type { RuntimeProgram } from '@advjs/types'
import type { Pinia } from 'pinia'
import type { CompileClientRuntimeProgramOptions } from '../runtime'
import type { AdvContext } from '../types'
import { $t } from '@advjs/client/modules/i18n'
import { watch } from 'vue'
import { useAdvAuto, useAdvBgm, useAdvTachies } from '../composables'
import { useAdvCharacters } from '../composables/useAdvCharacters'
import { createAdvRuntimeHost } from '../composables/useAdvRuntime'
import { initPixi } from '../pixi'
import {
  applyRuntimePresentationEffects,
  compileClientRuntimeProgram,
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

function runtimePlugins(value: unknown): AdvRuntimePlugin[] {
  if (!Array.isArray(value))
    return []
  return value.filter((plugin): plugin is AdvRuntimePlugin => Boolean(
    plugin
    && typeof plugin === 'object'
    && typeof (plugin as AdvRuntimePlugin).name === 'string'
    && typeof (plugin as AdvRuntimePlugin).version === 'string',
  ))
}

export function setupAdvContext(ctx: {
  config: AdvContext['config']
  gameConfig: AdvContext['gameConfig']
  themeConfig: AdvContext['themeConfig']
  pinia?: Pinia
  fetcher?: CompileClientRuntimeProgramOptions['fetcher']
  runtimePlugins?: unknown
}) {
  const store = useAdvStore(ctx.pinia)
  let advContext: AdvContext

  const runtime = createAdvRuntimeHost({
    program: BOOTSTRAP_PROGRAM,
    plugins: runtimePlugins(ctx.runtimePlugins),
    onState(state, current, program) {
      store.$syncRuntime(state, current, program)
      syncRuntimePresentation(state, ctx.gameConfig.value, ADV_RUNTIME)
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
    resources: ADV_RUNTIME,

    async init() {
      await initGameRuntime(advContext)
      const result = await compileClientRuntimeProgram({
        id: `adv-browser:${ctx.gameConfig.value.title || 'game'}`,
        chapters: ctx.gameConfig.value.chapters,
        fetcher: ctx.fetcher,
        requiredPlugins: ctx.gameConfig.value.requiredPlugins,
      })
      if (!result.program)
        throw compilerError(result.diagnostics)
      runtime.install(result.program, {
        initialVariables: ctx.gameConfig.value.variables,
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
