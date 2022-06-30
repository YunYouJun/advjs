import type * as MdAst from 'mdast'

export namespace AdvAst {
  export interface Node {
    type: string
  }

  export interface Unknown extends Node {
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

  export interface Go extends Node {
    type: 'go'
    target: string
  }

  export interface Choice extends Node {
    type: 'choice'
    choices: {
      text: string
      go?: string
    }[]
  }

  /**
   * 人物信息
   */
  export interface Character extends Node {
    type: 'character'
    name: string
    status: string
  }

  /**
   * 人物对话（单次发言话语）
   */
  export interface Words extends Node {
    type: 'words'
    text: string
  }

  /**
   * 文本可能被解析为会话
   */
  export interface Dialog extends Node {
    type: 'dialog'
    character: Character
    children: Text[]
  }

  export interface Paragraph extends Node {
    type: 'paragraph'
    children: (Text | Dialog)[]
  }

  export interface Heading extends Node {
    type: 'heading'
    depth: number
  }

  export interface SceneInfo extends Node {
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
  export interface Narration extends Node {
    type: 'narration'
    children: string[]
  }

  export interface Code extends MdAst.Code {
    type: 'code'
    value: CodeOperation[] | any
  }

  export interface Camera extends Node {
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

  export interface Tachie extends Node {
    type: 'tachie'
    enter: {
      character: string
      status: string
    }[]
    exit: string[]
  }

  export type CodeOperation = Camera | Tachie | Background | Go | Choice
  export type Item = Unknown | Paragraph | Narration | Character | Words | Text | SceneInfo | Dialog | Code

  export type Child = Item | MdAst.Content

  export interface Root {
    type: 'adv-root'
    children: Child[]
    scene: Record<string, number>
  }
}
