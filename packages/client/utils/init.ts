import type {
  AdvCharacter,
  RuntimeTachieState,
  SceneTransition,
  TachieMotion,
} from '@advjs/types'
import type { Ref } from 'vue'
import type { AdvContext } from '../types'
import { consola } from 'consola'
import { ref } from 'vue'

export interface TachieState extends RuntimeTachieState {
  /**
   * 立绘状态
   * @description
   * - 例如：`normal`, `happy`, `sad` 等
   */
  motion?: TachieMotion
}

export interface PresentationCue<T> {
  sequence: number
  value: T
}

export interface BackgroundPresentation {
  url: string
  transition?: SceneTransition
}

export interface CgPresentation {
  id: string
  action: 'show' | 'hide'
  unlock: boolean
  transition?: SceneTransition
}

export interface TransitionPresentation {
  name: string
  duration?: number
  easing?: string
}

export interface TachiePresentation {
  enter: Array<{ name: string, motion?: TachieMotion }>
  exit: Array<{ name: string, motion?: TachieMotion }>
  /** Restore final state without replaying author-declared motion. */
  instant?: boolean
}

/**
 * 运行时变量
 */
export const ADV_RUNTIME: {
  /**
   * 角色映射
   */
  charactersMap: Map<string, AdvCharacter>
  /**
   * 角色立绘映射
   *
   * ref for reactivity
   */
  tachiesMapRef: Ref<Map<string, TachieState>>
  backgroundCueRef: Ref<PresentationCue<BackgroundPresentation> | undefined>
  cgCueRef: Ref<PresentationCue<CgPresentation> | undefined>
  transitionCueRef: Ref<PresentationCue<TransitionPresentation> | undefined>
  tachieCueRef: Ref<PresentationCue<TachiePresentation> | undefined>
} = {
  charactersMap: new Map(),
  tachiesMapRef: ref(new Map()),
  backgroundCueRef: ref(),
  cgCueRef: ref(),
  transitionCueRef: ref(),
  tachieCueRef: ref(),
}

/**
 * init game
 * 初始化游戏
 * @description
 * - 建立 Map 关系，优化性能
 */
export async function initGameRuntime($adv: AdvContext) {
  if (typeof window !== 'undefined')
    (window as any).$adv = $adv
  const gameConfig = $adv.gameConfig.value
  consola.debug('Init Game Runtime', $adv.gameConfig)

  /**
   * init characters map
   */
  function initCharactersMap() {
    const { charactersMap } = ADV_RUNTIME
    charactersMap.clear()
    gameConfig.characters?.forEach((character) => {
      charactersMap.set(character.id, character)
    })
  }

  initCharactersMap()
  ADV_RUNTIME.tachiesMapRef.value = new Map()
  ADV_RUNTIME.backgroundCueRef.value = undefined
  ADV_RUNTIME.cgCueRef.value = undefined
  ADV_RUNTIME.transitionCueRef.value = undefined
  ADV_RUNTIME.tachieCueRef.value = undefined

  consola.debug('Game presentation resources initialized')
  return ADV_RUNTIME
}
