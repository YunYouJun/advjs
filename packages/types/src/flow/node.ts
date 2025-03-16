/**
 * 考虑到需要通过节点编辑器进行编辑
 *
 * 结构参考 React/Vue Flow 的节点结构
 */

export interface AdvFlowNode extends Node {
  id: string
  /**
   * 节点类型
   */
  type: string
  // /**
  //  * 跳转节点
  //  */
  // next: string
}
