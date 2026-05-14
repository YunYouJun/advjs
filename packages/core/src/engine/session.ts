/* eslint-disable node/prefer-global/process */
import type { PlaySession, PlaySessionSnapshot } from './types'
import { createStorage, prefixStorage } from 'unstorage'

function isNode(): boolean {
  return typeof globalThis.process !== 'undefined'
    && typeof globalThis.process.versions?.node === 'string'
}

/**
 * Session manager for CLI play sessions
 * Uses unstorage with platform-agnostic memory driver by default.
 * fs driver is loaded dynamically only in Node.js environment.
 */
export class SessionManager {
  private storage
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor(private baseDir?: string) {
    // Start with memory storage, upgrade to fs when init() completes
    const raw = createStorage()
    this.storage = prefixStorage(raw, 'session')
  }

  private normalizeSession(session: PlaySession): PlaySession {
    return {
      ...session,
      tachies: session.tachies ?? {},
      background: session.background ?? '',
      bgm: session.bgm ?? '',
      choices: session.choices ?? {},
    }
  }

  /**
   * Lazily initialize fs-backed storage in Node.js environment
   */
  private async init() {
    if (this.initialized)
      return
    if (this.initPromise)
      return this.initPromise

    this.initPromise = (async () => {
      if (isNode()) {
        const fsDriverModule = await import('unstorage/drivers/fs')
        const fsDriver = fsDriverModule.default
        const baseDir = this.baseDir || `${globalThis.process.env.HOME || '~'}/.advjs/play-sessions`
        const raw = createStorage({
          driver: fsDriver({ base: baseDir }),
        })
        this.storage = prefixStorage(raw, 'session')
      }
      this.initialized = true
    })()

    return this.initPromise
  }

  /**
   * Get or create a session
   */
  async getOrCreate(id: string, scriptPath: string, ast: string): Promise<PlaySession> {
    await this.init()
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
      bgm: '',
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
    await this.init()
    const session = await this.storage.getItem(id) as PlaySession | null
    return session ? this.normalizeSession(session) : null
  }

  /**
   * Save a session
   */
  async save(session: PlaySession): Promise<void> {
    await this.init()
    session.updatedAt = Date.now()
    await this.storage.setItem(session.id, this.normalizeSession(session))
  }

  /**
   * Export a session into a portable snapshot.
   */
  async exportSnapshot(id: string): Promise<PlaySessionSnapshot | null> {
    const session = await this.get(id)
    if (!session)
      return null
    return {
      session,
      ast: session.ast,
    }
  }

  /**
   * Import a portable snapshot. Optionally restore it under a new session ID.
   */
  async importSnapshot(snapshot: PlaySessionSnapshot, sessionId?: string): Promise<PlaySession> {
    const session = this.normalizeSession({
      ...snapshot.session,
      id: sessionId || snapshot.session.id,
      ast: snapshot.ast || snapshot.session.ast,
    })
    await this.save(session)
    return session
  }

  /**
   * Delete a session
   */
  async delete(id: string): Promise<void> {
    await this.init()
    await this.storage.removeItem(id)
  }

  /**
   * List all session IDs
   */
  async list(): Promise<string[]> {
    await this.init()
    return await this.storage.getKeys()
  }
}
