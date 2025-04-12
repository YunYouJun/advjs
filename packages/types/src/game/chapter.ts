import type { AdvFlowNode } from '../flow'

/**
 * 游戏章节
 */
export interface AdvChapter {
  /**
   * Chapter ID
   */
  id: string
  /**
   * Chapter title
   */
  title: string
  /**
   * Chapter Description
   */
  description?: string
  /**
   * Chapter Flow
   *
   * JSON or URL
   */
  // data: AdvFlow | string
  nodes: AdvFlowNode[]
}
