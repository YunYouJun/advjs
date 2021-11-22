import { Parent } from 'mdast'

export interface AdvRoot extends Parent {
  type: 'adv-root'
  children: []
}

export interface Unknown {
  type: 'unknown'
}

/**
 * 人物信息
 */
export interface Character {
  type: 'character'
  name: string
  status: string
}

/**
 * 人物对话
 */
export interface Words {
  type: 'words'
  text: string
}

export interface Line {
  type: 'line'
  character: Character
  words: Words
}

export interface Paragraph {
  type: 'paragraph'
  children: Line[]
}

export interface Heading {
  type: 'heading'
  depth: number
  text: string
}

/**
 * 旁白
 */
export interface Narration {
  type: 'narration'
  text: string
}

export type AdvItem = Unknown | Paragraph | Line | Narration | Character | Words
