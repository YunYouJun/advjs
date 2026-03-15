import type { PlaySession } from './types'
import process from 'node:process'
import { createStorage, prefixStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'

const DEFAULT_SESSION_DIR = `${process.env.HOME || '~'}/.advjs/play-sessions`

/**
 * Session manager for CLI play sessions
 * Uses unstorage with fs driver for persistence
 */
export class SessionManager {
  private storage

  constructor(baseDir: string = DEFAULT_SESSION_DIR) {
    const raw = createStorage({
      driver: fsDriver({ base: baseDir }),
    })
    this.storage = prefixStorage(raw, 'session')
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
    return await this.storage.getItem(id) as PlaySession | null
  }

  /**
   * Save a session
   */
  async save(session: PlaySession): Promise<void> {
    session.updatedAt = Date.now()
    await this.storage.setItem(session.id, session)
  }

  /**
   * Delete a session
   */
  async delete(id: string): Promise<void> {
    await this.storage.removeItem(id)
  }

  /**
   * List all session IDs
   */
  async list(): Promise<string[]> {
    return await this.storage.getKeys()
  }
}
