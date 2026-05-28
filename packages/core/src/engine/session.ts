/* eslint-disable node/prefer-global/process */
import type { PlaySession, PlaySessionSnapshot, SaveSlotEntry, SaveSlotMeta } from './types'
import { createStorage, prefixStorage } from 'unstorage'

const SLOT_NAME_RE = /^[\w-]{1,40}$/

export function isValidSlotName(slot: string): boolean {
  return SLOT_NAME_RE.test(slot)
}

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
  private slotStorage
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor(private baseDir?: string) {
    // Start with memory storage, upgrade to fs when init() completes
    const raw = createStorage()
    this.storage = prefixStorage(raw, 'session')
    this.slotStorage = prefixStorage(raw, 'save-slot')
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
        const home = globalThis.process.env.HOME || '~'
        const sessionBase = this.baseDir || `${home}/.advjs/play-sessions`
        const slotBase = this.baseDir
          ? `${this.baseDir.replace(/\/play-sessions$/, '')}/save-slots`
          : `${home}/.advjs/save-slots`

        const sessionRaw = createStorage({ driver: fsDriver({ base: sessionBase }) })
        this.storage = prefixStorage(sessionRaw, 'session')

        const slotRaw = createStorage({ driver: fsDriver({ base: slotBase }) })
        this.slotStorage = prefixStorage(slotRaw, 'save-slot')
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
      visitedNodes: [],
      unlockedCGs: [],
      history: [],
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

  /**
   * Rollback a session by popping the most recent entries off its history stack.
   *
   * The top of `history` is the currently displayed node. Popping `steps` entries
   * jumps `currentIndex` back to the deepest remaining entry. If history is empty
   * or smaller than `steps`, rolls back as far as possible (no-op if empty).
   *
   * `status` is forced to `'playing'` so a rolled-back session can advance again
   * even if it had reached `'waiting_choice'` or `'ended'`.
   */
  async rollback(sessionId: string, steps = 1): Promise<PlaySession | null> {
    if (steps < 1)
      return this.get(sessionId)

    const session = await this.get(sessionId)
    if (!session)
      return null

    const history = [...(session.history ?? [])]
    if (history.length === 0)
      return session

    // Pop up to `steps` entries; the remaining top is the new currentIndex.
    const popCount = Math.min(steps, history.length - 1 < 0 ? 0 : history.length)
    for (let i = 0; i < popCount; i++)
      history.pop()

    const newIndex = history.length > 0 ? history[history.length - 1] : 0

    session.history = history
    session.currentIndex = newIndex
    session.status = 'playing'
    await this.save(session)
    return session
  }

  /**
   * Build the slot storage key (`<sessionId>:<slot>`).
   *
   * unstorage uses `:` as a path separator under the fs driver, so each
   * session's slots end up under their own subdirectory on disk.
   */
  private slotKey(sessionId: string, slot: string): string {
    return `${sessionId}:${slot}`
  }

  /**
   * Persist a named save slot for a session.
   */
  async saveSlot(sessionId: string, slot: string, meta: Omit<SaveSlotMeta, 'slot' | 'sessionId' | 'createdAt'>): Promise<SaveSlotMeta> {
    if (!isValidSlotName(slot))
      throw new Error(`Invalid slot name "${slot}" — use letters, digits, "-" or "_" (max 40 chars)`)

    const snapshot = await this.exportSnapshot(sessionId)
    if (!snapshot)
      throw new Error(`Session not found: ${sessionId}`)

    await this.init()
    const fullMeta: SaveSlotMeta = {
      ...meta,
      slot,
      sessionId,
      createdAt: Date.now(),
    }
    const entry: SaveSlotEntry = { meta: fullMeta, snapshot }
    await this.slotStorage.setItem(this.slotKey(sessionId, slot), entry)
    return fullMeta
  }

  /**
   * Load a named save slot.
   */
  async loadSlot(sessionId: string, slot: string): Promise<SaveSlotEntry | null> {
    await this.init()
    const entry = await this.slotStorage.getItem(this.slotKey(sessionId, slot)) as SaveSlotEntry | null
    return entry
  }

  /**
   * List slots for a given session, ordered newest first.
   */
  async listSlots(sessionId: string): Promise<SaveSlotMeta[]> {
    await this.init()
    const prefix = `${sessionId}:`
    const keys = await this.slotStorage.getKeys(prefix)
    const results: SaveSlotMeta[] = []
    for (const key of keys) {
      const entry = await this.slotStorage.getItem(key) as SaveSlotEntry | null
      if (entry?.meta)
        results.push(entry.meta)
    }
    return results.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Delete a single slot. Returns whether the slot existed.
   */
  async deleteSlot(sessionId: string, slot: string): Promise<boolean> {
    await this.init()
    const key = this.slotKey(sessionId, slot)
    const existing = await this.slotStorage.getItem(key)
    if (!existing)
      return false
    await this.slotStorage.removeItem(key)
    return true
  }
}
