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
  status: 'playing' | 'waiting_choice' | 'ended'
  createdAt: number
  updatedAt: number
}

/**
 * Formatted output types for CLI display
 */
export type FormattedOutput
  = | { type: 'dialog', text: string, character: string, status?: string }
    | { type: 'narration', text: string }
    | { type: 'choices', text: string, options: { index: number, label: string }[] }
    | { type: 'scene', text: string, place?: string, time?: string }
    | { type: 'text', text: string }
    | { type: 'end', text: string }

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
