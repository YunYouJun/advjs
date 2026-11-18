import type { CompileDiagnostic, MarkdownResourceCatalog } from '@advjs/core'
import type { AdvGameConfig, AdvGameExtraItem, RuntimeProgram } from '@advjs/types'
import type { Pinia } from 'pinia'
import type { CompileClientRuntimeProgramOptions } from '../runtime'
import type { AdvClientRuntimePlugin, AdvContext } from '../types'
import { createRuntimeRouteGraph, extrasUnlockKey } from '@advjs/core'
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
  createBrowserExtrasController,
  createBrowserGalleryController,
  createBrowserReadLog,
  createBrowserRuntimeProgression,
  extrasNamespace,
  shouldCreateAutoSave,
  syncRuntimePresentation,
  validateSpritesheetDeclarations,
  validateSpritesheetImages,
} from '../runtime'
import { useAdvStore, useAudioStore, useGameStore, useSettingsStore } from '../stores'
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

function progressionController(gameConfig: AdvGameConfig, storage: Storage) {
  if (!gameConfig.progression)
    return undefined
  const unlockKeys = (['endings', 'achievements'] as const).flatMap(kind =>
    gameConfig[kind] ? [extrasUnlockKey(gameConfig[kind], kind)] : [],
  )
  return createBrowserRuntimeProgression(gameConfig.progression, { storage, unlockKeys })
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
  extrasStorage?: Storage | false
  readLogStorage?: Storage | false
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
  const extrasStorage = ctx.extrasStorage === false
    ? undefined
    : ctx.extrasStorage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  const readLogStorage = ctx.readLogStorage === false
    ? undefined
    : ctx.readLogStorage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  const extrasNotices = shallowRef<AdvGameExtraItem[]>([])
  let routeNodes: { hash: string, ids: ReadonlySet<string> } | undefined
  /** Install-time captures seed the record silently; only live unlocks raise toasts. */
  let installing = false
  /** Isolated sessions (scene replay) read but never write host-owned records. */
  let recording = true
  let initializationGeneration = 0
  let advContext: AdvContext
  const audio = useAudioStore(ctx.pinia)
  const syncAudioSettings = () => advContext.$audio.replaceUserSettings(JSON.parse(JSON.stringify(audio.settings)))

  const runtime = createAdvRuntimeHost({
    program: BOOTSTRAP_PROGRAM,
    plugins,
    onState(state, current, program, effects) {
      const previous = store.state.variables
      const restored = effects.some(effect => effect.type === 'runtime.restore' || effect.type === 'runtime.back')
      if (restored)
        advContext?.$auto.stop()
      // Update the read flag before publishing the node to synchronous skip watchers.
      advContext?.readLog?.capture(state, { restored })
      store.$syncRuntime(state, current, program)
      syncRuntimePresentation(state, ctx.gameConfig.value, ADV_RUNTIME)
      const historical = restored || effects.some(effect => effect.type === 'runtime.forward')
      if (recording && !historical && advContext?.progression) {
        try {
          advContext.progression.capture(state.variables, installing ? undefined : previous)
        }
        catch (error) {
          console.warn('[advjs] Failed to persist meta progression', error)
        }
      }
      if (recording && advContext?.extras && program) {
        if (routeNodes?.hash !== program.hash)
          routeNodes = { hash: program.hash, ids: new Set(createRuntimeRouteGraph(program).nodes.map(node => node.id)) }
        const captured = advContext.extras.capture(state, routeNodes.ids)
        const items = ctx.gameConfig.value.achievements?.items ?? []
        const unlocked = items.filter(item => captured.achievements.includes(item.id))
        if (!installing && !historical && unlocked.length)
          extrasNotices.value = [...extrasNotices.value, ...unlocked]
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
          recording ? advContext.gallery : undefined,
        )
      }
    },
  })

  function compileProgram(gameConfig: AdvGameConfig) {
    return compileClientRuntimeProgram({
      id: `adv-browser:${gameConfig.title || 'game'}`,
      chapters: gameConfig.chapters,
      entryChapterId: gameConfig.entryChapterId,
      fetcher: ctx.fetcher,
      requiredPlugins: gameConfig.requiredPlugins,
      resources: markdownResources(gameConfig),
    })
  }
  let compiledProgram: { config: AdvGameConfig, program: Promise<RuntimeProgram | undefined> } | undefined

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
    progression: progressionStorage ? progressionController(ctx.gameConfig.value, progressionStorage) : undefined,
    gallery: ctx.gameConfig.value.gallery && galleryStorage
      ? createBrowserGalleryController(ctx.gameConfig.value.gallery, { storage: galleryStorage })
      : undefined,
    extras: extrasStorage ? createBrowserExtrasController(ctx.gameConfig.value, { storage: extrasStorage }) : undefined,
    extrasNotices,

    async init(options = {}) {
      const generation = ++initializationGeneration
      const isCurrent = () => generation === initializationGeneration && (options.isCurrent?.() ?? true)
      if (!isCurrent())
        return
      advContext.$auto.stop()
      await advContext.$audio.reset()
      if (!isCurrent())
        return
      compileDiagnostics.value = []
      await initGameRuntime(advContext)
      if (!isCurrent())
        return
      const gameConfig = ctx.gameConfig.value
      const result = await compileProgram(gameConfig)
      if (!isCurrent())
        return
      const spritesheetDiagnostics = [
        ...validateSpritesheetDeclarations(gameConfig),
        ...await validateSpritesheetImages(gameConfig),
      ]
      // A page left during loading must not overwrite a newer game session.
      if (!isCurrent())
        return
      compileDiagnostics.value = structuredClone([...result.diagnostics, ...spritesheetDiagnostics])
      const errors = compileDiagnostics.value.filter(item => item.severity === 'error')
      if (!result.program || errors.length > 0)
        throw compilerError(errors.length > 0 ? errors : result.diagnostics)

      const persistence = options.persistence !== false
      game.setPreviewMode(!persistence || options.isolated === true)
      recording = options.isolated !== true
      advContext.progression = persistence && progressionStorage ? progressionController(gameConfig, progressionStorage) : undefined
      const galleryConfig = gameConfig.gallery
      if (persistence && galleryConfig && galleryStorage) {
        const expectedKey = `advjs:gallery:${encodeURIComponent(galleryConfig.id)}:v${galleryConfig.version ?? 1}`
        if (advContext.gallery?.storageKey !== expectedKey)
          advContext.gallery = createBrowserGalleryController(galleryConfig, { storage: galleryStorage })
      }
      else {
        advContext.gallery = undefined
      }
      if (persistence && extrasStorage) {
        const expectedKey = `advjs:extras:${encodeURIComponent(extrasNamespace(ctx.gameConfig.value))}:v1`
        if (advContext.extras?.storageKey !== expectedKey)
          advContext.extras = createBrowserExtrasController(ctx.gameConfig.value, { storage: extrasStorage })
      }
      else {
        advContext.extras = undefined
      }
      advContext.readLog = createBrowserReadLog(result.program, {
        storage: game.previewMode ? undefined : readLogStorage,
      })
      const configuredVariables = { ...ctx.gameConfig.value.variables, ...options.variables }
      const initialVariables = advContext.progression && recording
        ? advContext.progression.restore(configuredVariables)
        : configuredVariables
      installing = true
      extrasNotices.value = []
      try {
        runtime.install(result.program, {
          initialVariables,
        })
      }
      finally {
        installing = false
      }
      syncAudioSettings()
      const pixiGame = await initPixi(advContext)
      if (isCurrent())
        advContext.pixiGame = pixiGame
    },

    loadProgram() {
      const installed = runtime.program.value as RuntimeProgram | undefined
      if (installed && installed.id !== BOOTSTRAP_PROGRAM.id)
        return Promise.resolve(installed)
      const config = ctx.gameConfig.value
      if (compiledProgram?.config !== config) {
        compiledProgram = {
          config,
          program: compileProgram(config).then(result => result.program).catch(() => undefined),
        }
      }
      return compiledProgram.program
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
  const settings = useSettingsStore(ctx.pinia)
  advContext.$auto = useAdvAuto(advContext, {
    skipMode: () => settings.storage.skip === 'all' ? 'all' : 'read',
  })

  runtime.subscribeTrace((entry) => {
    if (!recording || !shouldCreateAutoSave(entry))
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
