import type {
  AdvCharacter,
  AdvGameConfig,
  JsonObject,
  RuntimeEffect,
  RuntimeState,
  SceneTransition,
  TachieMotion,
} from '@advjs/types'
import type { ref } from 'vue'
import type { useAdvBgm } from '../composables'
import type {
  BackgroundPresentation,
  CgPresentation,
  PresentationCue,
  TachiePresentation,
  TachieState,
  TransitionPresentation,
} from '../utils'
import type { RuntimeGalleryController } from './gallery'
import { getCharacter } from '@advjs/core'

export interface AdvPresentationResources {
  charactersMap: Map<string, AdvCharacter>
  tachiesMapRef: ReturnType<typeof ref<Map<string, TachieState>>>
  backgroundCueRef: ReturnType<typeof ref<PresentationCue<BackgroundPresentation> | undefined>>
  cgCueRef: ReturnType<typeof ref<PresentationCue<CgPresentation> | undefined>>
  transitionCueRef: ReturnType<typeof ref<PresentationCue<TransitionPresentation> | undefined>>
  tachieCueRef: ReturnType<typeof ref<PresentationCue<TachiePresentation> | undefined>>
}

function record(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : undefined
}

function nextCue<T>(current: PresentationCue<T> | undefined, value: T): PresentationCue<T> {
  return { sequence: (current?.sequence ?? 0) + 1, value }
}

function sceneTransition(value: unknown): SceneTransition | undefined {
  if (typeof value === 'string')
    return value as SceneTransition
  const data = record(value)
  if (!data || typeof data.name !== 'string')
    return undefined
  return {
    name: data.name as never,
    ...(typeof data.duration === 'number' ? { duration: data.duration } : {}),
    ...(typeof data.easing === 'string' ? { easing: data.easing } : {}),
  }
}

function characterId(gameConfig: Readonly<AdvGameConfig>, name: string): string {
  return getCharacter(gameConfig.characters, name)?.id ?? name
}

export function syncRuntimePresentation(
  state: Readonly<RuntimeState>,
  gameConfig: Readonly<AdvGameConfig>,
  resources: AdvPresentationResources,
): void {
  const tachies = new Map<string, TachieState>()
  for (const [name, tachie] of Object.entries(state.stage.tachies)) {
    const character = getCharacter(gameConfig.characters, name)
    tachies.set(character?.id ?? name, structuredClone(tachie))
  }
  resources.tachiesMapRef.value = tachies
}

export function applyRuntimePresentationEffects(
  effects: readonly RuntimeEffect[],
  state: Readonly<RuntimeState>,
  bgm: ReturnType<typeof useAdvBgm>,
  resources: AdvPresentationResources,
  gameConfig: Readonly<AdvGameConfig>,
  gallery?: RuntimeGalleryController,
): void {
  const historyNavigation = effects.some(effect => (
    effect.type === 'runtime.back'
    || effect.type === 'runtime.forward'
    || effect.type === 'runtime.restore'
  ))
  if (historyNavigation) {
    resources.backgroundCueRef.value = nextCue(resources.backgroundCueRef.value, {
      url: state.stage.background,
      transition: 'cut',
    })
    resources.cgCueRef.value = nextCue(resources.cgCueRef.value, {
      id: state.stage.cg,
      action: state.stage.cg ? 'show' : 'hide',
      unlock: false,
      transition: 'cut',
    })
    resources.transitionCueRef.value = nextCue(resources.transitionCueRef.value, {
      name: 'cut',
      duration: 0,
    })
    resources.tachieCueRef.value = nextCue(resources.tachieCueRef.value, {
      enter: Object.keys(state.stage.tachies).map(name => ({ name: characterId(gameConfig, name) })),
      exit: [],
      instant: true,
    })
    bgm.syncWithOptions(state.stage.bgm, { fadeIn: 120, fadeOut: 120 })
    return
  }

  for (const effect of effects) {
    const payload = record(effect.payload)
    if (!payload)
      continue

    if (effect.type === 'stage.background') {
      const url = typeof payload.url === 'string' ? payload.url : ''
      resources.backgroundCueRef.value = nextCue(resources.backgroundCueRef.value, {
        url,
        ...(sceneTransition(payload.transition) ? { transition: sceneTransition(payload.transition) } : {}),
      })
    }
    else if (effect.type === 'stage.bgm') {
      const fade = record(payload.fade)
      bgm.syncWithOptions(typeof payload.value === 'string' ? payload.value : '', {
        loop: payload.loop !== false,
        ...(typeof fade?.in === 'number' ? { fadeIn: fade.in } : {}),
        ...(typeof fade?.out === 'number' ? { fadeOut: fade.out } : {}),
      })
    }
    else if (effect.type === 'stage.cg') {
      const id = typeof payload.id === 'string' ? payload.id : ''
      const action = payload.action === 'hide' ? 'hide' : 'show'
      const cue: CgPresentation = {
        id,
        action,
        unlock: payload.unlock !== false,
        ...(sceneTransition(payload.transition) ? { transition: sceneTransition(payload.transition) } : {}),
      }
      resources.cgCueRef.value = nextCue(resources.cgCueRef.value, cue)
      if (action === 'show' && cue.unlock && id)
        gallery?.unlock(id)
    }
    else if (effect.type === 'stage.transition') {
      const cue: TransitionPresentation = {
        name: typeof payload.name === 'string' ? payload.name : 'crossfade',
        ...(typeof payload.duration === 'number' ? { duration: payload.duration } : {}),
        ...(typeof payload.easing === 'string' ? { easing: payload.easing } : {}),
      }
      resources.transitionCueRef.value = nextCue(resources.transitionCueRef.value, cue)
    }
    else if (effect.type === 'stage.tachie') {
      const enterValues = Array.isArray(payload.enter) ? payload.enter : [payload.enter]
      const exitValues = Array.isArray(payload.exit) ? payload.exit : []
      const cue: TachiePresentation = {
        enter: enterValues.flatMap((item) => {
          if (typeof item === 'string')
            return [{ name: characterId(gameConfig, item) }]
          const data = record(item)
          if (!data || typeof data.name !== 'string')
            return []
          return [{
            name: characterId(gameConfig, data.name),
            ...(typeof data.motion === 'string' ? { motion: data.motion as TachieMotion } : {}),
          }]
        }),
        exit: exitValues.flatMap((item) => {
          if (typeof item === 'string')
            return [{ name: characterId(gameConfig, item) }]
          const data = record(item)
          if (!data || typeof data.name !== 'string')
            return []
          return [{
            name: characterId(gameConfig, data.name),
            ...(typeof data.motion === 'string' ? { motion: data.motion as TachieMotion } : {}),
          }]
        }),
      }
      resources.tachieCueRef.value = nextCue(resources.tachieCueRef.value, cue)
    }
  }
}
