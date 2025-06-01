import type { AdvFlowNode } from '@advjs/types'
import type { AdvContext } from '../types'
import { convertMdToAdv, mdParse } from '@advjs/parser'
import { consola } from 'consola'

export type ChapterNodesMap = Map<string, AdvFlowNode>
export type ChaptersMap = Map<string, {
  nodesMap: ChapterNodesMap
}>

/**
 * 运行时变量
 */
export const ADV_RUNTIME: {
  chaptersMap: ChaptersMap
} = {
  chaptersMap: new Map(),
}

/**
 * init game
 * 初始化游戏
 * @description
 * - 建立 Map 关系，优化性能
 */
export async function initGameRuntime($adv: AdvContext) {
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
        nodesMap: chapterNodesMap,
      })
    })
  }

  initChaptersMap()

  // init first chapter nodes
  consola.info('Init First Chapter Nodes')
  const firstChapter = gameConfig.chapters?.[0]
  if (firstChapter) {
    // init nodes map
    const nodesMap = new Map<string, AdvFlowNode>()
    firstChapter.nodes.forEach((node) => {
      nodesMap.set(node.id, node)
    })

    // init fountain nodes
    const fountainNodes = firstChapter.nodes.filter(node => node.type === 'fountain')
    // promise.all
    await Promise.all(fountainNodes.map(async (node) => {
      const src = node.src
      // fetch and parse src
      const md = await fetch(src).then(res => res.text())
      // parse md
      const parsedTokens = await mdParse(md)
      const parsedAst = convertMdToAdv(parsedTokens)
      consola.info(parsedAst)

      nodesMap.set(node.id, {
        ...node,
        ast: parsedAst,
      })
    }))

    ADV_RUNTIME.chaptersMap.set(firstChapter.id, {
      nodesMap,
    })
  }

  consola.info('Game Runtime Initialized', ADV_RUNTIME.chaptersMap)
}
