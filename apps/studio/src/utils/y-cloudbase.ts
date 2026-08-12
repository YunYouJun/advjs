import type cloudbase from '@cloudbase/js-sdk'
import type { Doc } from 'yjs'
import * as Y from 'yjs'

// --- Types ---

export interface YCloudbaseProviderOptions {
  /** CloudBase app instance */
  cloudApp: cloudbase.app.App
  /** Room ID (CloudBase collab room _id) */
  roomId: string
  /** Client identifier (usually user UID) */
  clientId: string
  /** Display name for awareness */
  displayName?: string
  /**
   * Max number of incremental updates before compaction.
   * When exceeded, all updates are merged into a single snapshot.
   * @default 200
   */
  compactThreshold?: number
  /**
   * Awareness update interval in ms.
   * Controls how often cursor/selection state is pushed to CloudBase.
   * @default 1000
   */
  awarenessInterval?: number
}

export interface AwarenessState {
  clientId: string
  displayName: string
  /** Cursor position in the current file */
  cursor?: { line: number, column: number }
  /** Selection range */
  selection?: { startLine: number, startColumn: number, endLine: number, endColumn: number }
  /** Which file is being edited */
  currentFile?: string
  /** Epoch ms */
  lastUpdated: number
}

interface CollabUpdate {
  _id?: string
  roomId: string
  /** Base64-encoded Yjs update */
  update: string
  clientId: string
  /** Monotonic sequence number within the room */
  seq: number
  /** Epoch ms */
  timestamp: number
  /** If true, this is a compacted snapshot (full state vector) */
  isSnapshot?: boolean
}

// --- Constants ---

const COLLECTION_UPDATES = 'advjs_collab_updates'
const COLLECTION_AWARENESS = 'advjs_collab_awareness'
const DEFAULT_COMPACT_THRESHOLD = 200
const DEFAULT_AWARENESS_INTERVAL = 1000

// --- Provider ---

/**
 * Yjs sync provider using CloudBase realtime database (watch API).
 *
 * Architecture:
 * 1. On connect: load all existing updates from DB, apply to doc
 * 2. Local changes: write incremental updates to DB
 * 3. Remote changes: CloudBase watch() pushes new docs → apply to local doc
 * 4. Compaction: when update count exceeds threshold, merge into single snapshot
 *
 * This is a simplified provider suitable for ~500ms latency collaborative editing.
 * It does NOT implement Yjs awareness protocol (online presence is handled separately
 * by useCollabStore's heartbeat mechanism).
 */
export class YCloudbaseProvider {
  private doc: Doc
  private cloudApp: cloudbase.app.App
  private roomId: string
  private clientId: string
  private displayName: string
  private compactThreshold: number
  private awarenessInterval: number

  private watcher: any = null
  private awarenessWatcher: any = null
  private isConnected = false
  private isSynced = false
  private lastSeq = 0
  private localFlushCount = 0

  /** Pending updates that haven't been written to DB yet (debounce buffer) */
  private pendingUpdate: Uint8Array | null = null
  private flushTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Set of applied update document IDs — used to deduplicate updates
   * that may arrive from both initial load and watch replay.
   * Bounded to MAX_APPLIED_IDS to prevent unbounded memory growth.
   */
  private appliedIds: Set<string> = new Set()
  private static readonly MAX_APPLIED_IDS = 500

  /** Awareness state */
  private localAwareness: Partial<AwarenessState> = {}
  private remoteAwareness: Map<string, AwarenessState> = new Map()
  private awarenessTimer: ReturnType<typeof setInterval> | null = null
  private awarenessDocId: string | null = null

  /** Event listeners */
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map()

  constructor(doc: Doc, options: YCloudbaseProviderOptions) {
    this.doc = doc
    this.cloudApp = options.cloudApp
    this.roomId = options.roomId
    this.clientId = options.clientId
    this.displayName = options.displayName || options.clientId
    this.compactThreshold = options.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD
    this.awarenessInterval = options.awarenessInterval ?? DEFAULT_AWARENESS_INTERVAL

    // Listen for local doc updates
    this.doc.on('update', this.onLocalUpdate)
  }

  // --- Public API ---

  /**
   * Connect to CloudBase and start syncing.
   */
  async connect(): Promise<void> {
    if (this.isConnected)
      return

    // disconnect() detaches the listener so a stopped provider cannot retain
    // the Y.Doc. Reattach it when the same provider instance reconnects.
    // Yjs de-duplicates identical listeners, but off/on also keeps this safe
    // across implementations of the observable API.
    this.doc.off('update', this.onLocalUpdate)
    this.doc.on('update', this.onLocalUpdate)

    this.isConnected = true
    this.emit('status', [{ status: 'connecting' }])

    try {
      // 1. Load existing updates
      await this.loadInitialState()
      this.isSynced = true
      this.emit('synced', [true])
      this.emit('status', [{ status: 'connected' }])

      // 2. Start watching for remote updates
      this.startWatching()

      // 3. Start awareness (cursor/selection sync)
      this.startAwareness()
    }
    catch (err) {
      this.isConnected = false
      this.emit('status', [{ status: 'disconnected' }])
      this.emit('connection-error', [err])
      throw err
    }
  }

  /**
   * Disconnect from CloudBase.
   */
  disconnect(): void {
    // Flush before flipping connection state; otherwise the guard in
    // flushPendingUpdate() drops the last debounced edit.
    this.flushPendingUpdate()

    this.isConnected = false
    this.isSynced = false

    // Stop awareness
    this.stopAwareness()

    // Stop watching
    if (this.watcher) {
      this.watcher.close?.()
      this.watcher = null
    }

    // Clean up timer
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    this.doc.off('update', this.onLocalUpdate)
    this.emit('status', [{ status: 'disconnected' }])
  }

  /**
   * Destroy the provider and clean up all resources.
   */
  destroy(): void {
    this.disconnect()
    this.listeners.clear()
  }

  // --- Event Emitter ---

  on(event: string, fn: (...args: any[]) => void): void {
    if (!this.listeners.has(event))
      this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(fn)
  }

  off(event: string, fn: (...args: any[]) => void): void {
    this.listeners.get(event)?.delete(fn)
  }

  private emit(event: string, args: any[]): void {
    this.listeners.get(event)?.forEach(fn => fn(...args))
  }

  // --- Awareness API ---

  /**
   * Update local awareness state (cursor, selection, current file).
   * This is debounced and pushed to CloudBase periodically.
   */
  setAwareness(state: Partial<Pick<AwarenessState, 'cursor' | 'selection' | 'currentFile'>>): void {
    Object.assign(this.localAwareness, state)
  }

  /**
   * Get all remote awareness states (other users' cursors/selections).
   */
  getAwarenessStates(): Map<string, AwarenessState> {
    return new Map(this.remoteAwareness)
  }

  // --- Internal ---

  /**
   * Load all existing updates from the database and apply to local doc.
   */
  private async loadInitialState(): Promise<void> {
    const db = this.cloudApp.database()

    // Find the latest snapshot first (if any)
    const snapshotResult = await db.collection(COLLECTION_UPDATES)
      .where({ roomId: this.roomId, isSnapshot: true })
      .orderBy('seq', 'desc')
      .limit(1)
      .get()

    let startSeq = 0

    if (snapshotResult.data && snapshotResult.data.length > 0) {
      const snapshot = snapshotResult.data[0] as CollabUpdate
      const update = base64ToUint8Array(snapshot.update)
      Y.applyUpdate(this.doc, update, 'remote')
      startSeq = snapshot.seq
    }

    // Load incremental updates after the snapshot
    const updatesResult = await db.collection(COLLECTION_UPDATES)
      .where({
        roomId: this.roomId,
        seq: db.command.gt(startSeq),
        isSnapshot: db.command.neq(true),
      })
      .orderBy('seq', 'asc')
      .limit(1000)
      .get()

    if (updatesResult.data) {
      for (const doc of updatesResult.data as CollabUpdate[]) {
        // Apply ALL updates (including own) to reconstruct full doc state.
        // The clientId filter is only used in the realtime watcher to avoid
        // echo of current-session writes.
        const update = base64ToUint8Array(doc.update)
        Y.applyUpdate(this.doc, update, 'remote')
        if (doc._id)
          this.trackAppliedId(doc._id)
        if (doc.seq > this.lastSeq)
          this.lastSeq = doc.seq
      }
    }
  }

  /**
   * Start watching for remote updates via CloudBase realtime.
   *
   * Uses a simple `{ roomId }` filter instead of compound inequality filters,
   * since CloudBase watch() may not reliably support compound where clauses.
   * Client-side deduplication via `appliedIds` prevents replayed updates.
   */
  private startWatching(): void {
    const db = this.cloudApp.database()

    try {
      this.watcher = db.collection(COLLECTION_UPDATES)
        .where({ roomId: this.roomId })
        .watch({
          onChange: (snapshot: any) => {
            if (!snapshot.docChanges)
              return

            for (const change of snapshot.docChanges) {
              if (change.dataType !== 'add' && change.dataType !== 'update')
                continue

              const doc = change.doc as CollabUpdate
              if (!doc || doc.clientId === this.clientId)
                continue

              // Deduplicate: skip already-applied updates (from initial load or replay)
              if (doc._id && this.appliedIds.has(doc._id))
                continue

              const update = base64ToUint8Array(doc.update)
              // Yjs applyUpdate is idempotent — safe even if dedup misses
              Y.applyUpdate(this.doc, update, 'remote')

              if (doc._id)
                this.trackAppliedId(doc._id)
              if (doc.seq > this.lastSeq)
                this.lastSeq = doc.seq
            }
          },
          onError: (err: any) => {
            console.warn('[y-cloudbase] Watch error:', err)
            this.emit('connection-error', [err])
          },
        })
    }
    catch (err) {
      console.warn('[y-cloudbase] Failed to start watch:', err)
    }
  }

  // --- Awareness (cursor/selection sync via CloudBase watch) ---

  /**
   * Start awareness sync: periodic push + watch for remote states.
   */
  private startAwareness(): void {
    // Push local awareness periodically
    this.awarenessTimer = setInterval(() => {
      this.pushAwareness()
    }, this.awarenessInterval)

    // Push immediately on connect
    this.pushAwareness()

    // Watch remote awareness changes
    try {
      const db = this.cloudApp.database()
      this.awarenessWatcher = db.collection(COLLECTION_AWARENESS)
        .where({ roomId: this.roomId })
        .watch({
          onChange: (snapshot: any) => {
            if (!snapshot.docs)
              return

            const newStates = new Map<string, AwarenessState>()
            for (const doc of snapshot.docs) {
              if (doc.clientId === this.clientId)
                continue
              newStates.set(doc.clientId, {
                clientId: doc.clientId,
                displayName: doc.displayName,
                cursor: doc.cursor,
                selection: doc.selection,
                currentFile: doc.currentFile,
                lastUpdated: doc.lastUpdated,
              })
            }
            this.remoteAwareness = newStates
            this.emit('awareness-change', [newStates])
          },
          onError: (err: any) => {
            console.warn('[y-cloudbase] Awareness watch error:', err)
          },
        })
    }
    catch {
      // Graceful degradation — awareness is nice-to-have
    }
  }

  /**
   * Stop awareness sync.
   */
  private stopAwareness(): void {
    if (this.awarenessTimer) {
      clearInterval(this.awarenessTimer)
      this.awarenessTimer = null
    }
    if (this.awarenessWatcher) {
      this.awarenessWatcher.close?.()
      this.awarenessWatcher = null
    }

    // Remove our awareness doc from the collection
    if (this.awarenessDocId) {
      const db = this.cloudApp.database()
      db.collection(COLLECTION_AWARENESS)
        .doc(this.awarenessDocId)
        .remove()
        .catch(() => { /* best effort cleanup */ })
      this.awarenessDocId = null
    }

    this.remoteAwareness.clear()
  }

  /**
   * Push local awareness state to CloudBase.
   */
  private async pushAwareness(): Promise<void> {
    if (!this.isConnected)
      return

    try {
      const db = this.cloudApp.database()
      const state: Omit<AwarenessState, 'lastUpdated'> & { roomId: string, lastUpdated: number } = {
        clientId: this.clientId,
        displayName: this.displayName,
        cursor: this.localAwareness.cursor,
        selection: this.localAwareness.selection,
        currentFile: this.localAwareness.currentFile,
        lastUpdated: Date.now(),
        roomId: this.roomId,
      }

      if (this.awarenessDocId) {
        // Update existing doc
        await db.collection(COLLECTION_AWARENESS)
          .doc(this.awarenessDocId)
          .update(state)
      }
      else {
        // Create new doc
        const result = await db.collection(COLLECTION_AWARENESS).add(state)
        this.awarenessDocId = ((result as any)._id || (result as any).id) as string
      }
    }
    catch {
      // Non-critical
    }
  }

  // --- Deduplication ---

  /**
   * Track an applied update ID for deduplication.
   * Bounded to MAX_APPLIED_IDS to prevent unbounded memory growth.
   */
  private trackAppliedId(id: string): void {
    this.appliedIds.add(id)
    if (this.appliedIds.size > YCloudbaseProvider.MAX_APPLIED_IDS) {
      // Evict oldest entries (Set iterates in insertion order)
      const iter = this.appliedIds.values()
      const toRemove = this.appliedIds.size - YCloudbaseProvider.MAX_APPLIED_IDS
      for (let i = 0; i < toRemove; i++)
        this.appliedIds.delete(iter.next().value!)
    }
  }

  /**
   * Handle local document updates — buffer and write to DB.
   */
  private onLocalUpdate = (update: Uint8Array, origin: any): void => {
    // Skip updates from remote (to avoid echo)
    if (origin === 'remote' || !this.isConnected)
      return

    // Merge with pending update
    if (this.pendingUpdate) {
      this.pendingUpdate = Y.mergeUpdates([this.pendingUpdate, update])
    }
    else {
      this.pendingUpdate = update
    }

    // Debounce: flush after 300ms of inactivity
    if (this.flushTimer)
      clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => this.flushPendingUpdate(), 300)
  }

  private nextSeq(): number {
    const nowSeq = Date.now() * 1000 + Math.floor(Math.random() * 1000)
    this.lastSeq = Math.max(this.lastSeq + 1, nowSeq)
    return this.lastSeq
  }

  /**
   * Write the buffered pending update to CloudBase.
   */
  private async flushPendingUpdate(): Promise<void> {
    if (!this.pendingUpdate || !this.isConnected)
      return

    const update = this.pendingUpdate
    this.pendingUpdate = null

    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }

    try {
      const db = this.cloudApp.database()
      const seq = this.nextSeq()
      this.localFlushCount += 1

      const record: Omit<CollabUpdate, '_id'> = {
        roomId: this.roomId,
        update: uint8ArrayToBase64(update),
        clientId: this.clientId,
        seq,
        timestamp: Date.now(),
      }

      await db.collection(COLLECTION_UPDATES).add(record)

      // Check if compaction is needed
      this.maybeCompact(db, seq)
    }
    catch (err) {
      // Re-queue the update for retry (only if still connected)
      if (this.isConnected) {
        if (this.pendingUpdate) {
          this.pendingUpdate = Y.mergeUpdates([update, this.pendingUpdate])
        }
        else {
          this.pendingUpdate = update
        }
      }
      this.emit('write-error', [err])
      console.warn('[y-cloudbase] Failed to flush update:', err)
    }
  }

  /**
   * Compact old updates into a single snapshot when threshold is exceeded.
   */
  private async maybeCompact(
    db: ReturnType<cloudbase.app.App['database']>,
    currentSeq: number,
  ): Promise<void> {
    // Only compact every N local flushes and only if we're the one who triggered it.
    // `seq` is time-shaped to reduce cross-client collisions, so do not use modulo on it.
    if (this.localFlushCount % this.compactThreshold !== 0)
      return

    try {
      // Encode the full document state as a snapshot
      const fullState = Y.encodeStateAsUpdate(this.doc)
      const snapshotRecord: Omit<CollabUpdate, '_id'> = {
        roomId: this.roomId,
        update: uint8ArrayToBase64(fullState),
        clientId: this.clientId,
        seq: currentSeq,
        timestamp: Date.now(),
        isSnapshot: true,
      }

      await db.collection(COLLECTION_UPDATES).add(snapshotRecord)

      // Delete old non-snapshot updates (keep the last batch as buffer).
      // Best-effort bulk cleanup — won't block the main flow.
      await db.collection(COLLECTION_UPDATES)
        .where({
          roomId: this.roomId,
          seq: db.command.lt(currentSeq - 10),
          isSnapshot: db.command.neq(true),
        })
        .remove()
    }
    catch (err) {
      console.warn('[y-cloudbase] Compaction failed:', err)
    }
  }
}

// --- Utility Functions ---

function uint8ArrayToBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.byteLength; i++)
    binary += String.fromCharCode(data[i])
  return btoa(binary)
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64)
  const data = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    data[i] = binary.charCodeAt(i)
  return data
}
