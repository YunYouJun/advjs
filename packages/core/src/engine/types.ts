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
  /** Indexes of nodes the player has reached (for skip-read / completion %). */
  visitedNodes?: number[]
  /** Unlocked CG identifiers (background image paths). */
  unlockedCGs?: string[]
  /** History stack of node indexes — used to power rollback. FIFO cap 200. */
  history?: number[]
  createdAt: number
  updatedAt: number
}

/** Max entries kept in `PlaySession.history`. Older entries are dropped FIFO. */
export const PLAY_HISTORY_MAX = 200

export interface PlaySessionSnapshot {
  session: PlaySession
  ast: string
}

/**
 * Metadata describing a named save slot.
 *
 * Save slots are user-curated snapshots of a session — separate from the
 * working session storage, so they can be recalled even after the live
 * session advances or is deleted.
 */
export interface SaveSlotMeta {
  slot: string
  sessionId: string
  scriptPath: string
  currentIndex: number
  totalNodes: number
  /** Optional chapter/title taken from the script frontmatter. */
  chapterTitle?: string
  /** Short preview (≤80 chars) of the dialog/narration at save time. */
  previewText?: string
  /** Free-form note from the user. */
  note?: string
  createdAt: number
}

export interface SaveSlotEntry {
  meta: SaveSlotMeta
  snapshot: PlaySessionSnapshot
}

export interface TachieRich {
  name: string
  status?: string
  appearance?: string
}

export interface PlayStageState {
  background: string
  bgm: string
  tachies: Record<string, { status: string }>
  tachieAscii: string[]
  /** Enriched per-character info, populated when a game root is configured. */
  tachieRich?: TachieRich[]
  /** Loose mood hint inferred from the BGM name. */
  bgmHint?: string
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
