import type { Content } from 'mdast'

export interface AdvNode {
  type: string
}

export interface Unknown extends AdvNode {
  type: 'unknown'
}

/**
 * 普通文本
 */
export interface Text {
  type: 'text'
  value: string
}

/**
 * 人物信息
 */
export interface Character extends AdvNode {
  type: 'character'
  name: string
  status: string
}

/**
 * 人物对话（单次发言话语）
 */
export interface Words extends AdvNode {
  type: 'words'
  text: string
}

/**
 * 文本可能被解析为会话
 */
export interface Dialog extends AdvNode {
  type: 'dialog'
  character: Character
  children: Text[]
}

export interface Paragraph extends AdvNode {
  type: 'paragraph'
  children: (Text | Dialog)[]
}

export interface Heading extends AdvNode {
  type: 'heading'
  depth: number
}

export interface SceneInfo extends AdvNode {
  type: 'scene'
  /**
   * 地点
   */
  place: string
  /**
   * 时间
   */
  time: string
  /**
   * 内/外景
   */
  inOrOut: string
}

/**
 * 旁白
 */
export interface Narration extends AdvNode {
  type: 'narration'
  children: any[]
}

export type AdvItem = Unknown | Paragraph | Narration | Character | Words | Text | SceneInfo | Dialog

export type AdvChild = AdvItem | Content

export interface AdvRoot {
  type: 'adv-root'
  children: AdvChild[]
}
