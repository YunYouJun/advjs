import type { CompileDiagnostic, MarkdownResourceCatalog } from '@advjs/core'
import type { AdvGameConfig, RuntimeProgram } from '@advjs/types'
import type { Pinia } from 'pinia'
import type { CompileClientRuntimeProgramOptions } from '../runtime'
import type { AdvClientRuntimePlugin, AdvContext } from '../types'
import { shallowRef, watch } from 'vue'
import { useAdvAuto, useAdvBgm, useAdvTachies } from '../composables'
import { useAdvCharacters } from '../composables/useAdvCharacters'
import { createAdvRuntimeHost } from '../composables/useAdvRuntime'
import { $t } from '../modules/i18n'
import { initPixi } from '../pixi'
import {
  applyRuntimePresentationEffects,
  compileClientRuntimeProgram,
  createActivityRendererRegistry,
  createBrowserGalleryController,
  createBrowserRuntimeProgression,
  shouldCreateAutoSave,
  syncRuntimePresentation,
  validateSpritesheetDeclarations,
  validateSpritesheetImages,
} from '../runtime'
import { useAdvStore, useAudioStore, useGameStore } from '../stores'
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

function markdownResources(gameConfig: AdvGameConfig): MarkdownResourceCatalog {
  const tachies: Record<string, string[]> = {}
  for (const character of gameConfig.characters ?? []) {
    const statuses = Object.keys(character.tachies ?? {})
    for (const name of [character.id, character.name, ...(character.aliases ?? [])])
      tachies[name] = statuses
  }
  const library = gameConfig.bgm?.library
  return {
    backgrounds: (gameConfig.scenes ?? []).map(scene => scene.id),
    cgs: gameConfig.gallery?.items.map(item => item.id) ?? [],
    bgms: library && typeof library === 'object' && !Array.isArray(library)
      ? Object.keys(library)
      : undefined,
    tachies,
  }
}

export function setupAdvContext(ctx: {
  config: AdvContext['config']
  gameConfig: AdvContext['gameConfig']
  themeConfig: AdvContext['themeConfig']
  pinia?: Pinia
  fetcher?: CompileClientRuntimeProgramOptions['fetcher']
  runtimePlugins?: unknown
  progressionStorage?: Storage | false
  galleryStorage?: Storage | false
}) {
  const store = useAdvStore(ctx.pinia)
  const game = useGameStore(ctx.pinia)
  const plugins = runtimePlugins(ctx.runtimePlugins)
  const activityRenderers = createActivityRendererRegistry(plugins)
  const compileDiagnostics = shallowRef<CompileDiagnostic[]>([])
  const progressionStorage = ctx.progressionStorage === false
    ? undefined
    : ctx.progressionStorage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  const galleryStorage = ctx.galleryStorage === false
    ? undefined
    : ctx.galleryStorage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
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
    onEffects(effects, state) {
      if (advContext) {
        applyRuntimePresentationEffects(
          effects,
          state,
          advContext.$bgm,
          ADV_RUNTIME,
          ctx.gameConfig.value,
          advContext.gallery,
        )
      }
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
    progression: ctx.gameConfig.value.progression && progressionStorage
      ? createBrowserRuntimeProgression(ctx.gameConfig.value.progression, { storage: progressionStorage })
      : undefined,
    gallery: ctx.gameConfig.value.gallery && galleryStorage
      ? createBrowserGalleryController(ctx.gameConfig.value.gallery, { storage: galleryStorage })
      : undefined,

    async init() {
      compileDiagnostics.value = []
      await initGameRuntime(advContext)
      const result = await compileClientRuntimeProgram({
        id: `adv-browser:${ctx.gameConfig.value.title || 'game'}`,
        chapters: ctx.gameConfig.value.chapters,
        fetcher: ctx.fetcher,
        requiredPlugins: ctx.gameConfig.value.requiredPlugins,
        resources: markdownResources(ctx.gameConfig.value),
      })
      const spritesheetDiagnostics = [
        ...validateSpritesheetDeclarations(ctx.gameConfig.value),
        ...await validateSpritesheetImages(ctx.gameConfig.value),
      ]
      compileDiagnostics.value = structuredClone([...result.diagnostics, ...spritesheetDiagnostics])
      const errors = compileDiagnostics.value.filter(item => item.severity === 'error')
      if (!result.program || errors.length > 0)
        throw compilerError(errors.length > 0 ? errors : result.diagnostics)

      const progressionConfig = ctx.gameConfig.value.progression
      if (progressionConfig && progressionStorage) {
        const expectedKey = `advjs:progression:${encodeURIComponent(progressionConfig.id)}:v${progressionConfig.version ?? 1}`
        if (advContext.progression?.storageKey !== expectedKey)
          advContext.progression = createBrowserRuntimeProgression(progressionConfig, { storage: progressionStorage })
      }
      const galleryConfig = ctx.gameConfig.value.gallery
      if (galleryConfig && galleryStorage) {
        const expectedKey = `advjs:gallery:${encodeURIComponent(galleryConfig.id)}:v${galleryConfig.version ?? 1}`
        if (advContext.gallery?.storageKey !== expectedKey)
          advContext.gallery = createBrowserGalleryController(galleryConfig, { storage: galleryStorage })
      }
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

  runtime.subscribeTrace((entry) => {
    if (!shouldCreateAutoSave(entry))
      return
    void game.autoSave(runtime.snapshot()).catch((error) => {
      console.warn('[advjs] Automatic save failed', error)
    })
  })

  const audio = useAudioStore()
  advContext.$bgm.setVolume(audio.bgmVolume)
  watch(() => audio.bgmVolume, value => advContext.$bgm.setVolume(value))

  return advContext
}
