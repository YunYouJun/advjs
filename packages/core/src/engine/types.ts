import type { AdvAst } from '@advjs/types'

/**
 * Play session state
 */
export interface PlaySession {
  id: string
  scriptPath: string
  ast: string // serialized AST JSON
  currentIndex: number
  choices: Record<number, number> // {nodeIndex: choiceIndex}
  tachies: Record<string, { status: string }>
  background: string
  bgm: string
  status: 'playing' | 'waiting_choice' | 'ended'
  createdAt: number
  updatedAt: number
}

export interface PlaySessionSnapshot {
  session: PlaySession
  ast: string
}

export interface PlayStageState {
  background: string
  bgm: string
  tachies: Record<string, { status: string }>
  tachieAscii: string[]
}

export interface FormattedOutputMeta {
  stage?: PlayStageState
}

/**
 * Formatted output types for CLI display
 */
export type FormattedOutput
  = | ({ type: 'dialog', text: string, character: string, status?: string } & FormattedOutputMeta)
    | ({ type: 'narration', text: string } & FormattedOutputMeta)
    | ({ type: 'choices', text: string, options: { index: number, label: string }[] } & FormattedOutputMeta)
    | ({ type: 'scene', text: string, place?: string, time?: string } & FormattedOutputMeta)
    | ({ type: 'text', text: string } & FormattedOutputMeta)
    | ({ type: 'end', text: string } & FormattedOutputMeta)

/**
 * Play engine configuration
 */
export interface PlayConfig {
  /** Session ID for persistence */
  sessionId?: string
  /** Output format */
  json?: boolean
}

/**
 * AST child node type alias
 */
export type AstChild = AdvAst.Child
