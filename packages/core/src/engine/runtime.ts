import type { AdvAst } from '@advjs/types'
import type { FormattedOutput, PlaySession, PlayStageState, TachieRich } from './types'
import { parseAst } from '@advjs/parser'
import { formatNode } from './formatter'
import { SessionManager } from './session'
import { PLAY_HISTORY_MAX } from './types'

const PREVIEW_MAX = 80

/**
 * Loose mood mapping inferred from BGM file names.
 * Order matters — first match wins.
 */
const BGM_MOOD_TABLE: { re: RegExp, hint: string }[] = [
  { re: /tense|battle|fight|combat|stress|chase/i, hint: 'tense' },
  { re: /sad|sorrow|melanchol|grief|lament|cry/i, hint: 'sad' },
  { re: /happy|joy|cheer|fun|playful|bright/i, hint: 'joyful' },
  { re: /calm|peace|gentle|soft|quiet|slow|relax/i, hint: 'calm' },
  { re: /myster|tense|dark|suspense|unease|creep/i, hint: 'mysterious' },
  { re: /epic|heroic|grand|triumph/i, hint: 'epic' },
  { re: /romance|love|warm|tender/i, hint: 'romantic' },
]

function inferBgmHint(bgm: string): string | undefined {
  if (!bgm)
    return undefined
  for (const { re, hint } of BGM_MOOD_TABLE) {
    if (re.test(bgm))
      return hint
  }
  return undefined
}

/**
 * Optional adapter — lets the engine read game project files (characters,
 * etc.) without taking a hard dependency on Node fs. Browser callers can
 * leave it unset.
 */
export interface EngineHooks {
  /** Look up enriched info for a tachie character by display name. */
  getCharacterMeta?: (name: string) => { appearance?: string } | undefined
}

/**
 * ADV Play Engine - Pure state machine for CLI interactive narrative
 *
 * Traverses AST children array, advancing `currentIndex` step by step.
 * - Dialog/Narration/Text/Scene: format and pause for display
 * - Choices: pause and wait for choose command
 * - Code (Camera/Tachie/Background/Go): silently update state, auto-advance
 * - End: when currentIndex >= children.length
 */
export class AdvPlayEngine {
  private ast: AdvAst.Root | null = null
  private session: PlaySession | null = null
  private sessionManager: SessionManager
  private hooks: EngineHooks = {}

  constructor(sessionDir?: string, hooks?: EngineHooks) {
    this.sessionManager = new SessionManager(sessionDir)
    if (hooks)
      this.hooks = hooks
  }

  /**
   * Update hooks after construction (e.g. once the CLI has resolved game root).
   */
  setHooks(hooks: EngineHooks): void {
    this.hooks = { ...this.hooks, ...hooks }
  }

  /**
   * Load a script from markdown content
   */
  async loadScript(content: string, scriptPath: string, sessionId?: string): Promise<FormattedOutput | null> {
    this.ast = await parseAst(content)

    const id = sessionId || `play-${Date.now()}`
    this.session = this.normalizeSession(await this.sessionManager.getOrCreate(
      id,
      scriptPath,
      JSON.stringify(this.ast),
    ))

    // If resuming an existing session, restore AST
    if (this.session.currentIndex > 0) {
      this.ast = JSON.parse(this.session.ast)
    }

    // Advance to the first displayable node
    return this.advanceToNextDisplayable()
  }

  /**
   * Load from an existing session
   */
  async resumeSession(sessionId: string): Promise<FormattedOutput | null> {
    this.session = await this.sessionManager.get(sessionId)
    if (!this.session)
      return null
    this.session = this.normalizeSession(this.session)

    this.ast = JSON.parse(this.session.ast)
    return this.advanceToNextDisplayable()
  }

  /**
   * Advance to the next node
   */
  async next(): Promise<FormattedOutput | null> {
    if (!this.ast || !this.session)
      return null

    if (this.session.status === 'ended')
      return this.withStage({ type: 'end', text: '— END —' })

    if (this.session.status === 'waiting_choice')
      return this.withStage(formatNode(this.ast.children[this.session.currentIndex]))

    this.session.currentIndex++
    return this.advanceToNextDisplayable()
  }

  /**
   * Make a choice at the current choices node
   */
  async choose(choiceIndex: number): Promise<FormattedOutput | null> {
    if (!this.ast || !this.session)
      return null

    if (this.session.status !== 'waiting_choice')
      return null

    const currentNode = this.ast.children[this.session.currentIndex]
    if (currentNode?.type !== 'choices')
      return null

    const choices = currentNode as AdvAst.Choices
    if (choiceIndex < 1 || choiceIndex > choices.choices.length)
      return null

    // Record the choice
    this.session.choices[this.session.currentIndex] = choiceIndex
    this.session.status = 'playing'

    // Handle go target if present
    const choice = choices.choices[choiceIndex - 1]
    if (choice.target && this.ast.scene[choice.target] !== undefined) {
      this.session.currentIndex = this.ast.scene[choice.target]
      return this.advanceToNextDisplayable()
    }

    // Otherwise advance to next node
    this.session.currentIndex++
    return this.advanceToNextDisplayable()
  }

  /**
   * Get the current node output without advancing
   */
  getCurrentNode(): FormattedOutput | null {
    if (!this.ast || !this.session)
      return null

    if (this.session.currentIndex >= this.ast.children.length)
      return this.withStage({ type: 'end', text: '— END —' })

    return this.withStage(formatNode(this.ast.children[this.session.currentIndex]))
  }

  /**
   * Check if the game has ended
   */
  isEnd(): boolean {
    if (!this.ast || !this.session)
      return true

    return this.session.status === 'ended'
      || this.session.currentIndex >= this.ast.children.length
  }

  /**
   * Get current session status
   */
  getStatus() {
    if (!this.session || !this.ast) {
      return {
        sessionId: null,
        status: 'no_session' as const,
        currentIndex: 0,
        totalNodes: 0,
        background: '',
        bgm: '',
        tachies: {},
        tachieAscii: [],
      }
    }

    return {
      sessionId: this.session.id,
      status: this.session.status,
      currentIndex: this.session.currentIndex,
      totalNodes: this.ast.children.length,
      background: this.session.background,
      bgm: this.session.bgm,
      tachies: this.session.tachies,
      tachieAscii: this.getTachieAscii(),
    }
  }

  /**
   * Get the session manager for external session operations
   */
  getSessionManager(): SessionManager {
    return this.sessionManager
  }

  /**
   * Reset current session
   */
  async reset(): Promise<void> {
    if (this.session) {
      await this.sessionManager.delete(this.session.id)
      this.session = null
      this.ast = null
    }
  }

  /**
   * Internal: advance through nodes until finding a displayable one
   */
  private async advanceToNextDisplayable(): Promise<FormattedOutput | null> {
    if (!this.ast || !this.session)
      return null

    while (this.session.currentIndex < this.ast.children.length) {
      const node = this.ast.children[this.session.currentIndex]
      const output = this.processNode(node)

      if (output) {
        this.trackVisit(this.session.currentIndex)
        await this.sessionManager.save(this.session)
        return this.withStage(output)
      }

      // Silent node, auto-advance
      this.session.currentIndex++
    }

    // Reached the end
    this.session.status = 'ended'
    await this.sessionManager.save(this.session)
    return this.withStage({ type: 'end', text: '— END —' })
  }

  /**
   * Process a single node, returning formatted output or null for silent nodes
   */
  private processNode(node: AdvAst.Child): FormattedOutput | null {
    if (!node || !node.type)
      return null

    // Handle code operations silently
    if (node.type === 'code') {
      this.handleCodeNode(node as AdvAst.Code)
      return null
    }

    // Handle choices - set waiting state
    if (node.type === 'choices') {
      this.session!.status = 'waiting_choice'
    }

    return formatNode(node)
  }

  /**
   * Handle code node side effects (background, tachie, camera, go)
   */
  private handleCodeNode(node: AdvAst.Code): void {
    if (!this.session || !node.value || typeof node.value === 'string')
      return

    const operations = node.value as AdvAst.CodeOperation[]
    for (const op of operations) {
      switch (op.type) {
        case 'background':
          if ('url' in op) {
            const url = (op as AdvAst.Background).url || ''
            this.session.background = url
            this.trackCGUnlock(url)
          }
          break
        case 'bgm': {
          const bgm = op as AdvAst.Bgm
          this.session.bgm = bgm.stop ? '' : (bgm.name || bgm.src || '')
          break
        }
        case 'tachie': {
          const tachie = op as AdvAst.Tachie
          if (tachie.enter) {
            const entries = Array.isArray(tachie.enter) ? tachie.enter : [tachie.enter]
            for (const t of entries) {
              if (typeof t === 'string') {
                this.session.tachies[t] = { status: '' }
              }
              else {
                this.session.tachies[t.name || ''] = { status: t.status || '' }
              }
            }
          }
          if (tachie.exit) {
            for (const t of tachie.exit)
              delete this.session.tachies[t]
          }
          break
        }
        case 'go': {
          const go = op as AdvAst.Go
          if (go.target && this.ast?.scene[go.target] !== undefined)
            this.session.currentIndex = this.ast.scene[go.target] - 1 // -1 because advanceToNextDisplayable will ++
          break
        }
        // camera operations are visual-only, no state to track in CLI
      }
    }
  }

  private normalizeSession(session: PlaySession): PlaySession {
    return {
      ...session,
      tachies: session.tachies ?? {},
      background: session.background ?? '',
      bgm: session.bgm ?? '',
      choices: session.choices ?? {},
      visitedNodes: session.visitedNodes ?? [],
      unlockedCGs: session.unlockedCGs ?? [],
      history: session.history ?? [],
    }
  }

  /**
   * Mark a node as visited and push it on the rollback history stack.
   * Idempotent for `visitedNodes`; history collapses consecutive duplicates so
   * silent re-displays (e.g. a `next()` that lands on the same index) don't
   * pollute the rollback target.
   */
  private trackVisit(index: number): void {
    if (!this.session)
      return
    this.session.visitedNodes ??= []
    this.session.history ??= []
    if (!this.session.visitedNodes.includes(index))
      this.session.visitedNodes.push(index)
    const top = this.session.history[this.session.history.length - 1]
    if (top !== index) {
      this.session.history.push(index)
      if (this.session.history.length > PLAY_HISTORY_MAX)
        this.session.history.shift()
    }
  }

  /**
   * Record a CG unlock (background image). Deduped.
   */
  private trackCGUnlock(url: string): void {
    if (!this.session || !url)
      return
    this.session.unlockedCGs ??= []
    if (!this.session.unlockedCGs.includes(url))
      this.session.unlockedCGs.push(url)
  }

  private getTachieAscii(): string[] {
    if (!this.session)
      return []
    return Object.entries(this.session.tachies)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, tachie]) => tachie.status ? `[${name}:${tachie.status}]` : `[${name}]`)
  }

  private getTachieRich(): TachieRich[] | undefined {
    if (!this.session || !this.hooks.getCharacterMeta)
      return undefined
    return Object.entries(this.session.tachies)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, tachie]) => {
        const meta = this.hooks.getCharacterMeta!(name)
        const rich: TachieRich = { name }
        if (tachie.status)
          rich.status = tachie.status
        if (meta?.appearance)
          rich.appearance = meta.appearance
        return rich
      })
  }

  private getStage(): PlayStageState {
    const bgm = this.session?.bgm ?? ''
    const stage: PlayStageState = {
      background: this.session?.background ?? '',
      bgm,
      tachies: { ...(this.session?.tachies ?? {}) },
      tachieAscii: this.getTachieAscii(),
    }
    const tachieRich = this.getTachieRich()
    if (tachieRich && tachieRich.length)
      stage.tachieRich = tachieRich
    const bgmHint = inferBgmHint(bgm)
    if (bgmHint)
      stage.bgmHint = bgmHint
    return stage
  }

  /**
   * Return a short preview of the current node text for save-slot metadata.
   */
  getCurrentPreviewText(): string | undefined {
    const node = this.getCurrentNode()
    if (!node)
      return undefined
    const text = (node.type === 'dialog' || node.type === 'narration' || node.type === 'text' || node.type === 'scene')
      ? node.text
      : ''
    if (!text)
      return undefined
    const collapsed = text.replace(/\s+/g, ' ').trim()
    return collapsed.length > PREVIEW_MAX
      ? `${collapsed.slice(0, PREVIEW_MAX - 1)}…`
      : collapsed
  }

  /**
   * Expose runtime AST for debug/branches analysis without re-parsing.
   */
  getAst(): AdvAst.Root | null {
    return this.ast
  }

  private withStage<T extends FormattedOutput | null>(output: T): T {
    if (!output)
      return output
    return {
      ...output,
      stage: this.getStage(),
    } as T
  }
}
