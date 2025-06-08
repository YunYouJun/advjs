import type { AdvFlowNode } from '@advjs/types'

export type ChapterNodesMap = Map<string, AdvFlowNode>
export type ChaptersMap = Map<string, {
  /**
   * 是否已加载完毕
   */
  loaded: boolean
  nodesMap: ChapterNodesMap
}>
