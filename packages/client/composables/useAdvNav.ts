import type { AdvFlowNode, AdvNode } from '@advjs/types'
import type { AdvContext } from '../types'
import { END_NODE } from '@advjs/core'
import { consola } from 'consola'
import { watch } from 'vue'

export function useAdvNav($adv: AdvContext) {
  const { store } = $adv

  const curChapterMap = new Map<string, AdvFlowNode>()

  /**
   * load chapter
   */
  async function loadChapter(index: number = 0) {
    consola.debug('Load Chapter', index)
    const curChapter = $adv.gameConfig.value.chapters[index]
    if (!curChapter)
      return

    // if (typeof curChapter.data === 'string') {
    //   const data = await fetch(curChapter.data)
    //   curChapter.data = await data.json()
    // }

    store.curChapter = JSON.parse(JSON.stringify(curChapter))
    // const { nodes, edges } = store.curChapter as AdvFlow
    const nodes = store.curChapter?.nodes || []
    nodes.forEach((node) => {
      curChapterMap.set(node.id, node)
    })
    // edges.forEach((edge) => {
    //   const source = curChapterMap.get(edge.source)
    //   const target = curChapterMap.get(edge.target)
    //   if (source && target) {
    //     source.target = target.id
    //   }
    // })
  }

  /**
   * start
   */
  async function start(nodeId: string) {
    consola.info('AdvJS Game Start')
    store.cur.order = 0

    await loadChapter(0)
    // store.curFlowNode = $adv.gameConfig.value.chapters[0].
    const startNode = curChapterMap.get(nodeId)
    if (!startNode)
      return

    store.curFlowNode = startNode
    // console.log('startNode', startNode)
    // next()
  }

  /**
   * go to scene
   * @param target
   */
  function go(target: string) {
    const order = store.ast.scene[target]
    if (Number.isNaN(order))
      consola.error(`Can not find screen ${target}`)
    else store.cur.order = order

    // next()
    if (target) {
      store.curFlowNode = curChapterMap.get(target) as AdvNode
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

    if (!store.curFlowNode.target) {
      consola.error('Can not find target')
      store.curFlowNode = END_NODE
    }
    else {
      const targetNode = curChapterMap.get(store.curFlowNode.target)
      if (!targetNode) {
        consola.error('Can not find target node')
      }
      else {
        store.curFlowNode = targetNode
      }
      consola.debug('Next', store.curFlowNode)
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

    // if (__DEV__)
    //   consola.info(curNode)

    // const skippedTypes = ['scene']
    // if (skippedTypes.includes(curNode.type || ''))
    //   return next()

    // if (await handleAdvNode(curNode))
    //   next()
  }

  /**
   * 处理节点
   */
  watch(() => store.curFlowNode, () => {
    $adv.$logic.handleAdvNode(store.curFlowNode)
  })

  return {
    start,
    next,
    go,
  }
}
