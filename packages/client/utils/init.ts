import type { AdvCharacter, AdvFlowNode } from '@advjs/types'
import type { Ref } from 'vue'
import type { AdvContext } from '../types'
import { consola } from 'consola'
import { ref } from 'vue'

export type ChapterNodesMap = Map<string, AdvFlowNode>
export type ChaptersMap = Map<string, {
  /**
   * 是否已加载完毕
   */
  loaded: boolean
  nodesMap: ChapterNodesMap
}>

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
   * 章节节点映射
   */
  chaptersMap: ChaptersMap
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
  chaptersMap: new Map(),
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
  (window as any).$adv = $adv
  consola.info('Init Game Runtime')
  const gameConfig = $adv.config.value.gameConfig

  /**
   * init map
   * 初始化章节节点映射关系
   */
  function initChaptersMap() {
    consola.debug('Init Chapters Map')
    const { chaptersMap } = ADV_RUNTIME
    gameConfig.chapters?.forEach((chapter) => {
      const chapterNodesMap = new Map<string, AdvFlowNode>()
      chapter.nodes.forEach((node) => {
        chapterNodesMap.set(node.id, node)
      })
      chaptersMap.set(chapter.id, {
        loaded: false,
        nodesMap: chapterNodesMap,
      })
    })
  }

  /**
   * init characters map
   */
  function initCharactersMap() {
    const { charactersMap } = ADV_RUNTIME
    gameConfig.characters?.forEach((character) => {
      charactersMap.set(character.id, character)
    })
  }

  initChaptersMap()
  initCharactersMap()

  // init first chapter nodes
  consola.info('Init First Chapter Nodes')
  const firstChapter = gameConfig.chapters?.[0]
  if (firstChapter) {
    await $adv.$nav.loadChapter(firstChapter.id)
  }

  consola.info('Game Runtime Initialized', ADV_RUNTIME.chaptersMap)
  return ADV_RUNTIME
}
