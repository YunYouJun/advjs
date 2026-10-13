import type { PlaySession } from './types'
import { createStorage, prefixStorage } from 'unstorage'

/**
 * Session manager for CLI play sessions
 * Uses unstorage with fs driver for persistence
 */
export class SessionManager {
  private storagePromise?: Promise<ReturnType<typeof prefixStorage>>

  constructor(private baseDir?: string) {}

  private async getStorage() {
    if (!this.storagePromise) {
      this.storagePromise = (async () => {
        // eslint-disable-next-line node/prefer-global/process -- Shared browser code cannot import node:process.
        const nodeProcess = globalThis.process
        if (!nodeProcess?.versions?.node)
          throw new Error('CLI session persistence requires Node.js')

        // Shared browser imports must not evaluate Node filesystem dependencies.
        const driverId = 'unstorage/drivers/fs'
        const { default: fsDriver } = await import(/* @vite-ignore */ driverId) as typeof import('unstorage/drivers/fs')
        const base = this.baseDir ?? `${nodeProcess.env.HOME || '~'}/.advjs/play-sessions`
        return prefixStorage(createStorage({ driver: fsDriver({ base }) }), 'session')
      })()
    }
    return await this.storagePromise
  }

  /**
   * Get or create a session
   */
  async getOrCreate(id: string, scriptPath: string, ast: string): Promise<PlaySession> {
    const existing = await this.get(id)
    if (existing)
      return existing

    const session: PlaySession = {
      id,
      scriptPath,
      ast,
      currentIndex: 0,
      choices: {},
      tachies: {},
      background: '',
      status: 'playing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    await this.save(session)
    return session
  }

  /**
   * Get a session by ID
   */
  async get(id: string): Promise<PlaySession | null> {
    return await (await this.getStorage()).getItem(id) as PlaySession | null
  }

  /**
   * Save a session
   */
  async save(session: PlaySession): Promise<void> {
    session.updatedAt = Date.now()
    await (await this.getStorage()).setItem(session.id, session)
  }

  /**
   * Delete a session
   */
  async delete(id: string): Promise<void> {
    await (await this.getStorage()).removeItem(id)
  }

  /**
   * List all session IDs
   */
  async list(): Promise<string[]> {
    return await (await this.getStorage()).getKeys()
  }
}
