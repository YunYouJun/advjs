import type * as MdAst from 'mdast'

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
  /**
   * load from assets by name
   */
  name?: string
  /**
   * load by url
   */
  url?: string
}

export interface Go extends Node {
  type: 'go'
  target: string
}

export interface Choice extends Node {
  type: 'choice'
  text: string
  /**
   * onClick
   * @default $adv.nav.next()
   */
  do?: Code
}

export interface Choices extends Node {
  type: 'choices'
  /**
   * checked item
   */
  default?: string
  choices: Choice[]
}

/**
 * 人物信息
 */
export interface Character extends Node {
  type: 'character'
  name: string
  /**
   * status of character to adjust tachie
   * @default '' as 'default'
   */
  status?: string
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
  children: PhrasingContent[]
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

export interface Code extends Omit<MdAst.Code, 'value'> {
  type: 'code'
  value: CodeOperation[] | string | null
}

export interface CodeFunction extends Code {
  type: 'code'
  value: string
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
  /**
   * enter character
   */
  enter: (Omit<Character, 'type'> | string)[] | string
  /**
   * exit character
   */
  exit: string[]
}

// content

export interface Emphasis extends Node {
  type: 'emphasis'
  children: PhrasingContent[]
}

export interface Strong extends Node {
  type: 'strong'
  children: PhrasingContent[]
}

export interface Delete extends Node {
  type: 'delete'
  children: PhrasingContent[]
}

export interface InlineCode extends Node {
  type: 'inlineCode'
}

export interface Break extends Node {
  type: 'break'
}

export interface Resource {
  url: string
  title?: string | null | undefined
}

export interface Link extends Node, Resource {
  type: 'link'
  children: PhrasingContent[]
}

export interface Image extends Node, Resource {
  type: 'image'
  alt?: string | null | undefined
}

export interface HTML extends Node {
  type: 'link'
  value: string
}

export interface PhrasingContentMap {
  text: Text
  // emphasis: Emphasis
  // strong: Strong
  // delete: Delete
  html: HTML
  // inlinecode: InlineCode
  // break: Break
  // inlinecode: InlineCode
  // break: Break
  // image: Image
}

export type PhrasingContent = PhrasingContentMap[keyof PhrasingContentMap]

export type CodeOperation = Camera | Tachie | Background | Go
export type Item = Unknown | Paragraph | Narration | Character | Words | Text | SceneInfo | Dialog | Choices | Code

export type Child = Item
export type ChildWithMd = Item | MdAst.Content

export interface Root {
  type: 'adv-root'
  children: Child[]
  scene: Record<string, number>
  /**
   * global scripts functions
   */
  functions: Record<string, string>
}
