import type { CompileDiagnostic, MarkdownResourceCatalog } from '@advjs/core'
import type { AdvGameConfig, RuntimeProgram } from '@advjs/types'
import type { Pinia } from 'pinia'
import type { CompileClientRuntimeProgramOptions } from '../runtime'
import type { AdvClientRuntimePlugin, AdvContext } from '../types'
import { shallowRef, watch } from 'vue'
import { followingVoiceLineIds } from '../audio/prefetch'
import { useAdvAudio, useAdvAuto, useAdvTachies } from '../composables'
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
  schemaVersion: 2,
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
  return {
    backgrounds: (gameConfig.scenes ?? []).map(scene => scene.id),
    speakers: Object.fromEntries((gameConfig.characters ?? []).flatMap(character => [character.id, character.name, ...(character.aliases ?? [])].map(name => [name, character.id]))),
    cgs: gameConfig.gallery?.items.map(item => item.id) ?? [],
    audio: Object.fromEntries(Object.entries(gameConfig.audio?.assets ?? {}).map(([id, asset]) => [id, asset.kind])),
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
  let initializationGeneration = 0
  let advContext: AdvContext
  const audio = useAudioStore(ctx.pinia)
  const syncAudioSettings = () => advContext.$audio.replaceUserSettings(JSON.parse(JSON.stringify(audio.settings)))

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
        void advContext.$audio.applyEffects(effects, state).catch(() => {
          compileDiagnostics.value = [...compileDiagnostics.value, {
            code: 'ADV_AUDIO_PLAYBACK_FAILED',
            severity: 'warning',
            message: 'Unable to play the current audio cue',
          }]
        })
        applyRuntimePresentationEffects(
          effects,
          state,
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
      const generation = ++initializationGeneration
      advContext.$auto.stop()
      await advContext.$audio.reset()
      compileDiagnostics.value = []
      await initGameRuntime(advContext)
      const result = await compileClientRuntimeProgram({
        id: `adv-browser:${ctx.gameConfig.value.title || 'game'}`,
        chapters: ctx.gameConfig.value.chapters,
        entryChapterId: ctx.gameConfig.value.entryChapterId,
        fetcher: ctx.fetcher,
        requiredPlugins: ctx.gameConfig.value.requiredPlugins,
        resources: markdownResources(ctx.gameConfig.value),
      })
      const spritesheetDiagnostics = [
        ...validateSpritesheetDeclarations(ctx.gameConfig.value),
        ...await validateSpritesheetImages(ctx.gameConfig.value),
      ]
      // A page left during loading must not overwrite a newer game session.
      if (generation !== initializationGeneration)
        return
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
      syncAudioSettings()
      advContext.pixiGame = await initPixi(advContext)
    },

    $t,
    $tachies: undefined as never,
    $characters: undefined as never,
    $audio: undefined as never,
    $auto: undefined as never,
  }
  advContext.$tachies = useAdvTachies(advContext)
  advContext.$characters = useAdvCharacters(advContext)
  advContext.$audio = useAdvAudio({
    gameConfig: () => ctx.gameConfig.value,
    isSkipping: () => advContext.$auto?.skipEnabled.value ?? false,
    onDiagnostic: (code, message) => { compileDiagnostics.value = [...compileDiagnostics.value, { code, severity: 'warning', message }] },
    onUserSettings: audio.replace,
    // The traversal is read-only; avoid recursively expanding Vue's JsonValue proxy type.
    voiceLineIds: state => followingVoiceLineIds(runtime.program.value as unknown as RuntimeProgram | undefined, state.cursor),
  })
  advContext.$auto = useAdvAuto(advContext)

  runtime.subscribeTrace((entry) => {
    if (!shouldCreateAutoSave(entry))
      return
    void game.autoSave(runtime.snapshot()).catch((error) => {
      console.warn('[advjs] Automatic save failed', error)
    })
  })

  watch(() => audio.settings, syncAudioSettings, { deep: true })

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Retain the latest context so a late-loading inspector can attach too.
    const devtoolsContext = {
      runtime,
      gameConfig: ctx.gameConfig,
      compileDiagnostics,
      observe: (notify: () => void) => watch(() => [
        runtime.state.value,
        runtime.current.value,
        runtime.program.value,
        ctx.gameConfig.value,
        compileDiagnostics.value,
      ], notify),
    }
    const host = window as Window & { __ADV_DEVTOOLS_CONTEXT__?: typeof devtoolsContext }
    host.__ADV_DEVTOOLS_CONTEXT__ = devtoolsContext
    window.dispatchEvent(new CustomEvent('advjs:devtools:runtime', { detail: devtoolsContext }))
  }

  return advContext
}
