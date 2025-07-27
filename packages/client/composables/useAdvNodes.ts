import type { AdvContext } from '../types'
import { consola } from 'consola'

/**
 * 节点相关的 Composable
 */
export function useAdvNodes($adv: AdvContext) {
  const { runtime } = $adv
  const { chaptersMap } = runtime

  /**
   * 获取节点
   */
  function get(params: { chapterId: string, nodeId: string }) {
    const { chapterId, nodeId } = params
    const chapter = chaptersMap.get(chapterId)
    if (!chapter) {
      consola.error(`Can not find chapter ${chapterId}`)
      return
    }
    const node = chapter.nodesMap.get(nodeId)
    if (!node) {
      consola.error(`Can not find node ${nodeId} in chapter ${chapterId}`)
      return
    }
    return node
  }

  return {
    get,
  }
}
