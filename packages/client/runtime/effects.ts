import type {
  AdvCharacter,
  AdvGameConfig,
  RuntimeEffect,
  RuntimeState,
} from '@advjs/types'
import type { ref } from 'vue'
import type { useAdvBgm } from '../composables'
import type { TachieState } from '../utils'
import { getCharacter } from '@advjs/core'

export interface AdvPresentationResources {
  charactersMap: Map<string, AdvCharacter>
  tachiesMapRef: ReturnType<typeof ref<Map<string, TachieState>>>
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
  bgm: ReturnType<typeof useAdvBgm>,
): void {
  const bgmEffect = effects.findLast(effect => effect.type === 'stage.bgm')
  if (!bgmEffect?.payload || typeof bgmEffect.payload !== 'object' || Array.isArray(bgmEffect.payload))
    return
  const value = typeof bgmEffect.payload.value === 'string' ? bgmEffect.payload.value : ''
  bgm.sync(value)
}
