/**
 * 考虑到需要通过节点编辑器进行编辑
 *
 * 结构参考 React/Vue Flow 的节点结构
 */

export interface AdvBaseNode {
  id: string
  /**
   * 节点类型
   */
  type: string
  /**
   * 目标节点
   *
   * @runtime
   */
  target?: string
}

export type AdvFlowNode = AdvBaseNode & Node

export interface AdvBackgroundNode extends AdvBaseNode {
  type: 'background'
  /**
   * 背景名称
   */
  name: string
  /**
   * 背景图片地址
   *
   * - url
   * - base64
   */
  src: string
}

export interface AdvTachieNode extends AdvBaseNode {
  type: 'tachie'
  /**
   * 角色名称
   */
  name: string
  /**
   * 角色状态
   *
   * @default 'default'
   */
  status: string
  /**
   * 动作
   */
  action: 'enter' | 'exit'
}

export interface AdvDialogNode {
  type: 'dialog'
  /**
   * 对话内容
   */
  text: string
  /**
   * 对话角色 ID
   */
  speaker?: string
}

export interface AdvDialoguesNode extends AdvBaseNode {
  type: 'dialogues'
  /**
   * 对话列表
   */
  children: AdvDialogNode[]
}

/**
 * 结束节点
 *
 * @runtime
 */
export interface AdvEndNode extends AdvBaseNode {
  type: 'end'
}

/**
 * adv node
 */
export type AdvNode = AdvBaseNode | AdvBackgroundNode | AdvTachieNode | AdvDialoguesNode | AdvEndNode
