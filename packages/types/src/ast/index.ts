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

export interface Background {
  type: 'background'
  url: string
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
  children: string[]
}

export interface Code extends AdvNode {
  type: 'code'
  value: any
}

export interface Camera extends AdvNode {
  type: 'camera'
  target?: {
    x: number
    y: number
    z: number
  }
  alpha?: number
  beta?: number
  radius?: number
}

export interface Tachie extends AdvNode {
  type: 'tachie'
  enter: {
    character: string
    status: string
  }[]
  exit: string[]
}

export type AdvItem = Unknown | Paragraph | Narration | Character | Words | Text | SceneInfo | Dialog | Camera | Code | Tachie | Background

export type AdvChild = AdvItem | Content

export interface AdvRoot {
  type: 'adv-root'
  children: AdvChild[]
}
