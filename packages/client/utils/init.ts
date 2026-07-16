import type { AdvCharacter } from '@advjs/types'
import type { Ref } from 'vue'
import type { AdvContext } from '../types'
import { consola } from 'consola'
import { ref } from 'vue'

export interface TachieState {
  /**
   * 立绘状态
   * @description
   * - 例如：`normal`, `happy`, `sad` 等
   */
  status: string
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
} = {
  charactersMap: new Map(),
  tachiesMapRef: ref(new Map()),
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

  consola.debug('Game presentation resources initialized')
  return ADV_RUNTIME
}
