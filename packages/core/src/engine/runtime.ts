import type { AdvAst } from '@advjs/types'
import type { FormattedOutput, PlaySession } from './types'
import { parseAst } from '@advjs/parser'
import { formatNode } from './formatter'
import { SessionManager } from './session'

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

  constructor(sessionDir?: string) {
    this.sessionManager = new SessionManager(sessionDir)
  }

  /**
   * Load a script from markdown content
   */
  async loadScript(content: string, scriptPath: string, sessionId?: string): Promise<FormattedOutput | null> {
    this.ast = await parseAst(content)

    const id = sessionId || `play-${Date.now()}`
    this.session = await this.sessionManager.getOrCreate(
      id,
      scriptPath,
      JSON.stringify(this.ast),
    )

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
      return { type: 'end', text: '— END —' }

    if (this.session.status === 'waiting_choice')
      return formatNode(this.ast.children[this.session.currentIndex])

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
      return { type: 'end', text: '— END —' }

    return formatNode(this.ast.children[this.session.currentIndex])
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
        tachies: {},
      }
    }

    return {
      sessionId: this.session.id,
      status: this.session.status,
      currentIndex: this.session.currentIndex,
      totalNodes: this.ast.children.length,
      background: this.session.background,
      tachies: this.session.tachies,
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
        await this.sessionManager.save(this.session)
        return output
      }

      // Silent node, auto-advance
      this.session.currentIndex++
    }

    // Reached the end
    this.session.status = 'ended'
    await this.sessionManager.save(this.session)
    return { type: 'end', text: '— END —' }
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
          if ('url' in op)
            this.session.background = (op as AdvAst.Background).url || ''
          break
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
}
