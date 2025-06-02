import type { AdvFlowNode } from '@advjs/types'
import type { AdvContext } from '../types'
import { END_NODE } from '@advjs/core'
import { convertMdToAdv, mdParse } from '@advjs/parser'
import { consola } from 'consola'
import { watch } from 'vue'
import { ADV_RUNTIME } from '../utils'

export type ChapterNodesMap = Map<string, AdvFlowNode>
export type ChaptersMap = Map<string, {
  nodesMap: ChapterNodesMap
}>

export function useAdvNav($adv: AdvContext) {
  const { store } = $adv

  const { chaptersMap } = ADV_RUNTIME

  /**
   * load chapter
   */
  async function loadChapter(id?: string) {
    const curChapter = id
      ? $adv.gameConfig.value.chapters.find(chapter => chapter.id === id)
      : store.curChapter || $adv.gameConfig.value.chapters[0]

    if (!curChapter)
      return

    if (chaptersMap.has(curChapter.id)) {
      const chapter = chaptersMap.get(curChapter.id)
      if (chapter?.loaded) {
        return chapter
      }
    }
    // if (typeof curChapter.data === 'string') {
    //   const data = await fetch(curChapter.data)
    //   curChapter.data = await data.json()
    // }

    // load chapter nodes
    const nodesMap = new Map<string, AdvFlowNode>()
    store.curChapter = curChapter
    // const { nodes, edges } = store.curChapter as AdvFlow
    const nodes = store.curChapter?.nodes || []
    nodes.forEach((node) => {
      nodesMap.set(node.id, node)
    })
    // edges.forEach((edge) => {
    //   const source = curChapterMap.get(edge.source)
    //   const target = curChapterMap.get(edge.target)
    //   if (source && target) {
    //     source.target = target.id
    //   }
    // })

    // init fountain nodes
    const fountainNodes = nodes.filter(node => node.type === 'fountain')
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

    chaptersMap.set(curChapter.id, {
      loaded: true,
      nodesMap,
    })

    const loadedChapter = chaptersMap.get(curChapter.id)
    consola.info(`Chapter ${curChapter.id} loaded`, loadedChapter)
    return loadedChapter
  }

  /**
   * start
   */
  async function start(params: {
    chapterId?: string
    nodeId: string
  }) {
    consola.info('AdvJS Game Start')
    store.cur.order = 0

    const { chapterId, nodeId } = params

    const chapter = await loadChapter(chapterId)
    if (!chapter) {
      consola.error('No chapter nodes found')
      return
    }
    const startNode = chapter.nodesMap.get(nodeId)
    if (!startNode)
      return

    store.curFlowNode = startNode
  }

  /**
   * go to target node
   * @param target
   */
  async function go(target: string | { chapterId: string, nodeId: string } | AdvFlowNode = END_NODE) {
    if (typeof target === 'object' && 'id' in target) {
      // 如果是 AdvFlowNode 对象，直接设置为当前节点
      store.curFlowNode = target
      return target
    }

    // go to target node
    let targetChapterId = ''
    let targetNodeId = ''
    if (typeof target === 'string') {
      targetChapterId = store.curChapter?.id || ''
      targetNodeId = target
    }
    else {
      targetChapterId = target.chapterId
      targetNodeId = target.nodeId
    }

    let targetChapter = chaptersMap.get(targetChapterId)
    if (!targetChapter) {
      consola.error(`Chapter ${targetChapterId} not found`)
      return
    }
    else if (!targetChapter.loaded) {
      targetChapter = await loadChapter(targetChapterId)
    }
    const targetNode = targetChapter?.nodesMap.get(targetNodeId)
    if (targetNode) {
      consola.debug(`Go to node ${target}`, targetNode)
      store.curFlowNode = targetNode
      return targetNode
    }
  }

  /**
   * 下一部分
   */
  async function next(): Promise<AdvFlowNode | undefined> {
    if (!store.curFlowNode) {
      consola.error('No curFlowNode')
      return
    }

    if (store.curFlowNode.type === 'fountain') {
      if (store.curFlowNode.order === undefined) {
        store.curFlowNode.order = 1
      }

      if (store.curFlowNode.ast && store.curFlowNode.order >= store.curFlowNode.ast.children?.length - 1) {
        await go(store.curFlowNode.target)
      }
      else if (store.curFlowNode.order) {
        store.curFlowNode.order++
      }
      else {
        store.curFlowNode.order = 1
      }
      return store.curFlowNode
    }

    if (!store.curFlowNode.target) {
      consola.error('Can not find target')
      store.curFlowNode = END_NODE
    }
    else {
      const targetNode = await go(store.curFlowNode.target)
      consola.debug('Next', targetNode)
      return targetNode
    }

    // if (!store.ast)
    //   return

    // const nodeLen = store.ast.children.length
    // const curOrder = store.cur.order
    // if (curOrder >= nodeLen)
    //   return

    // store.cur.order++

    // const curNode = store.curNode
    // // 跳过无效节点（虽然应该不会有）
    // if (!curNode)
    //   return next()

    // const skippedTypes = ['scene']
    // if (skippedTypes.includes(curNode.type || ''))
    //   return next()

    // if (await handleAdvNode(curNode))
    //   next()
  }

  /**
   * 处理节点
   */
  watch(() => store.curNode, () => {
    if (store.curNode) {
      $adv.$logic.handleAdvNode(store.curNode)
    }
  })

  return {
    loadChapter,
    start,
    next,
    go,
  }
}
