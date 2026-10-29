/**
 * In-memory file system adapter with IndexedDB persistence.
 *
 * Fallback for browsers that don't support File System Access API
 * (Safari, Firefox, all mobile browsers). Files are stored in a
 * simple Map and persisted to IndexedDB via a dedicated Dexie table.
 *
 * This allows full project editing without native file system access,
 * at the cost of not being able to open existing local directories.
 * Projects can be imported via .advpkg.zip or created from templates.
 */

import type { Table } from 'dexie'
import type { DbMemfsNode } from '../db'
import type { FsEntry, FsFileEntry, IFileSystem } from './types'
import { isTextFile } from './utils'

const TRIM_SLASHES_RE = /^\/+|\/+$/g
const MULTI_SLASH_RE = /\/+/g

let database: Promise<typeof import('../db')> | undefined
function openDatabase() {
  return database ??= import('../db')
}

/** Internal storage node */
interface FsNode {
  type: 'file' | 'directory'
  /** File content (text as string, binary as base64) */
  content?: string
  /** Binary data as Blob */
  blob?: Blob
  /** Last modification time */
  mtime: number
  /** File size in bytes */
  size: number
}

/**
 * Key for IndexedDB persistence table.
 * Format: `memfs:{projectId}:{path}`
 */
function dbKey(projectId: string, path: string): string {
  return `memfs:${projectId}:${path}`
}

function sameStoredNode(before?: DbMemfsNode, current?: DbMemfsNode): boolean {
  if (!before || !current)
    return before === current
  if (before.revision || current.revision)
    return Boolean(before.revision && before.revision === current.revision)
  if (before.type !== current.type || before.content !== current.content || before.mtime !== current.mtime || before.size !== current.size || before.mimeType !== current.mimeType)
    return false
  if (before.binary || current.binary) {
    if (!before.binary || !current.binary || before.binary.byteLength !== current.binary.byteLength)
      return false
    const bytes = new Uint8Array(current.binary)
    return new Uint8Array(before.binary).every((byte, index) => byte === bytes[index])
  }
  return before.blob?.size === current.blob?.size && before.blob?.type === current.blob?.type
}

export class MemoryFsAdapter implements IFileSystem {
  readonly backend = 'memory' as const

  /** path → FsNode */
  private nodes = new Map<string, FsNode>()
  private projectId: string
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  private persistQueue: Promise<void> = Promise.resolve()

  constructor(projectId: string) {
    this.projectId = projectId
  }

  /** The durable version each local edit was based on. */
  private baseline = new Map<string, DbMemfsNode>()
  private dirty = new Map<string, number>()
  private mutation = 0
  private transactionActive = false
  private staging = false
  private expired = false
  private observerId = crypto.randomUUID()

  /** Notifications carry no project bytes and grant no write or adoption authority. */
  subscribeExternalChanges(listener: () => void): () => void {
    if (this.expired || this.staging || typeof BroadcastChannel !== 'function')
      return () => {}
    let channel: BroadcastChannel
    try {
      channel = new BroadcastChannel(`advjs-studio:memfs:v1:${this.projectId}`)
    }
    catch {
      return () => {}
    }
    let active = true
    const receive = (event: MessageEvent) => {
      const hint = event.data
      if (!active || hint?.protocolVersion !== 1 || typeof hint.sender !== 'string' || hint.sender === this.observerId)
        return
      try {
        listener()
      }
      catch {}
    }
    channel.addEventListener('message', receive)
    return () => {
      active = false
      channel.removeEventListener('message', receive)
      channel.close()
    }
  }

  private announcePersistedChange(): void {
    if (typeof BroadcastChannel !== 'function')
      return
    let channel: BroadcastChannel | undefined
    try {
      channel = new BroadcastChannel(`advjs-studio:memfs:v1:${this.projectId}`)
      channel.postMessage({ protocolVersion: 1, sender: this.observerId })
    }
    catch {
      // Notification failure cannot turn an already committed batch into a write failure.
    }
    finally {
      try {
        channel?.close()
      }
      catch {}
    }
  }

  private node(row: DbMemfsNode): FsNode {
    return {
      type: row.type,
      content: row.content,
      blob: row.binary ? new Blob([row.binary], { type: row.mimeType ?? '' }) : row.blob,
      mtime: row.mtime,
      size: row.size,
    }
  }

  private async storedNodes(table: Table<DbMemfsNode, string>): Promise<Map<string, DbMemfsNode>> {
    const prefix = `memfs:${this.projectId}:`
    const rows = await table.where('key').startsWith(prefix).toArray()
    return new Map(rows.map(row => [row.key.slice(prefix.length), row]))
  }

  /** Read failures must not turn an existing project into an apparently empty one. */
  async init(): Promise<void> {
    await this.refresh()
  }

  /** Refresh untouched paths, retaining local drafts and their original compare versions. */
  async refresh(): Promise<void> {
    if (this.expired)
      throw new Error('ADV_STUDIO_TRANSACTION_BUSY')
    if (this.staging)
      return
    await this.persistQueue
    const { db } = await openDatabase()
    const stored = await this.storedNodes(db.table('memfsNodes'))
    for (const path of this.dirty.keys()) {
      if (this.nodes.get(path)?.type === 'directory' && stored.get(path)?.type === 'directory')
        continue
      if (!sameStoredNode(this.baseline.get(path), stored.get(path)))
        throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
    }
    this.acceptStored(stored)
  }

  private acceptStored(stored: Map<string, DbMemfsNode>): void {
    for (const path of new Set([...this.nodes.keys(), ...stored.keys()])) {
      if (this.dirty.has(path))
        continue
      const row = stored.get(path)
      if (row) {
        this.baseline.set(path, row)
        this.nodes.set(path, this.node(row))
      }
      else {
        this.baseline.delete(path)
        this.nodes.delete(path)
      }
    }
  }

  private change(path: string, node?: FsNode): void {
    if (this.expired || this.transactionActive)
      throw new Error('ADV_STUDIO_TRANSACTION_BUSY')
    if (node)
      this.nodes.set(path, node)
    else
      this.nodes.delete(path)
    this.dirty.set(path, ++this.mutation)
  }

  /** Schedule a debounced persist to IndexedDB. Strict callers use flush(). */
  private schedulePersist(): void {
    if (this.staging)
      return
    if (this.persistTimer)
      clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => void this.persist(), 500)
  }

  /** Atomically compare and commit changed paths; never replace another window's snapshot. */
  async persist(options: { strict?: boolean, expected?: ReadonlyMap<string, DbMemfsNode>, validate?: () => void } = {}): Promise<void> {
    if (this.persistTimer)
      clearTimeout(this.persistTimer)
    this.persistTimer = null
    // Preserve the portable representation when explicitly flushing legacy Blob rows.
    const paths = new Set([...this.dirty.keys(), ...[...this.baseline].filter(([, row]) => row.blob && !row.binary).map(([path]) => path)])
    const snapshot = [...paths].map(path => ({ path, version: this.dirty.get(path), node: this.nodes.get(path) }))
    const operation = this.persistQueue.then(async () => {
      // Blob conversion must finish before the IndexedDB transaction opens.
      const changes = await Promise.all(snapshot.map(async ({ path, node, version }) => ({
        path,
        version,
        row: node
          ? {
            key: dbKey(this.projectId, path),
            type: node.type,
            content: node.content ?? '',
            ...(node.blob ? { binary: await node.blob.arrayBuffer(), mimeType: node.blob.type } : {}),
            mtime: node.mtime,
            size: node.size,
            revision: crypto.randomUUID(),
          } satisfies DbMemfsNode
          : undefined,
      })))
      const { db } = await openDatabase()
      const table = db.table<DbMemfsNode, string>('memfsNodes')
      const stored = await db.transaction('rw', table, async () => {
        const current = await this.storedNodes(table)
        options.validate?.()
        if (options.expected && (current.size !== options.expected.size || [...options.expected].some(([path, row]) => !sameStoredNode(row, current.get(path)))))
          throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
        for (const { path, row } of changes) {
          // Concurrent creation of the same parent directory is harmless.
          if (row?.type === 'directory' && current.get(path)?.type === 'directory')
            continue
          if (!sameStoredNode(this.baseline.get(path), current.get(path)))
            throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
        }
        const result = new Map(current)
        for (const { path, row } of changes) {
          if (row) {
            if (!(row.type === 'directory' && current.get(path)?.type === 'directory'))
              result.set(path, row)
          }
          else {
            result.delete(path)
          }
        }
        // A recursive delete must not strand a child created by another window;
        // a new child must not resurrect a concurrently deleted/replaced parent.
        for (const [path] of result) {
          const parts = path.split('/')
          for (let i = 1; i < parts.length; i++) {
            if (result.get(parts.slice(0, i).join('/'))?.type !== 'directory')
              throw new Error('ADV_STUDIO_SOURCE_CONFLICT')
          }
        }
        const deleted = changes.filter(change => !change.row).map(change => dbKey(this.projectId, change.path))
        const rows = changes.flatMap(change => change.row ? [result.get(change.path)!] : [])
        if (deleted.length)
          await table.bulkDelete(deleted)
        if (rows.length)
          await table.bulkPut(rows)
        options.validate?.()
        return result
      })
      for (const { path, version } of changes) {
        const row = stored.get(path)
        if (row)
          this.baseline.set(path, row)
        else
          this.baseline.delete(path)
        if (this.dirty.get(path) === version)
          this.dirty.delete(path)
      }
      this.acceptStored(stored)
      if (changes.length)
        this.announcePersistedChange()
    })
    // Ordinary autosave remains nonfatal; critical callers observe failures.
    this.persistQueue = operation.catch(() => {})
    await (options.strict ? operation : this.persistQueue)
  }

  /** Critical project transactions must await durable bytes and observe storage errors. */
  async flush(): Promise<void> {
    if (this.expired || this.transactionActive)
      throw new Error('ADV_STUDIO_TRANSACTION_BUSY')
    if (!this.staging)
      await this.persist({ strict: true })
  }

  /** No staged file or debounce timer can leak out before the full-project CAS. */
  async transaction(operation: (scope: IFileSystem) => Promise<void>, validate?: () => void): Promise<void> {
    if (this.transactionActive || this.staging || this.expired)
      throw new Error('ADV_STUDIO_TRANSACTION_BUSY')
    this.transactionActive = true
    let staged: MemoryFsAdapter | undefined
    try {
      validate?.()
      await this.persist({ strict: true })
      await this.refresh()
      validate?.()
      staged = new MemoryFsAdapter(this.projectId)
      staged.nodes = new Map(this.nodes)
      staged.baseline = new Map(this.baseline)
      staged.staging = true
      staged.observerId = this.observerId
      const expected = new Map(this.baseline)
      const scope: IFileSystem = staged
      scope.transaction = undefined
      await operation(scope)
      await staged.persist({ strict: true, expected, validate })
      this.acceptStored(staged.baseline)
    }
    finally {
      if (staged) {
        staged.expired = true
        staged.nodes.clear()
        staged.baseline.clear()
        staged.dirty.clear()
      }
      this.transactionActive = false
    }
  }

  // --- helpers ---

  private normalizePath(path: string): string {
    if (this.expired)
      throw new Error('ADV_STUDIO_TRANSACTION_BUSY')
    return path.replace(TRIM_SLASHES_RE, '').replace(MULTI_SLASH_RE, '/')
  }

  private ensureParentDirs(path: string): void {
    const parts = path.split('/').filter(Boolean)
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      if (!this.nodes.has(dirPath)) {
        this.change(dirPath, {
          type: 'directory',
          mtime: Date.now(),
          size: 0,
        })
      }
    }
  }

  // --- IFileSystem implementation ---

  async readFile(path: string): Promise<string> {
    const p = this.normalizePath(path)
    const node = this.nodes.get(p)
    if (!node || node.type !== 'file') {
      throw new Error(`File not found: ${path}`)
    }
    return node.content ?? ''
  }

  async readBlob(path: string): Promise<Blob> {
    const p = this.normalizePath(path)
    const node = this.nodes.get(p)
    if (!node || node.type !== 'file') {
      throw new Error(`File not found: ${path}`)
    }
    if (node.blob)
      return node.blob
    // Fallback: convert text content to blob
    return new Blob([node.content ?? ''], { type: 'application/octet-stream' })
  }

  async readBlobUrl(path: string): Promise<string> {
    const blob = await this.readBlob(path)
    return URL.createObjectURL(blob)
  }

  async readdir(path: string): Promise<FsEntry[]> {
    const p = this.normalizePath(path)
    const prefix = p ? `${p}/` : ''
    const entries: FsEntry[] = []
    const seen = new Set<string>()

    for (const [nodePath, node] of this.nodes) {
      if (!nodePath.startsWith(prefix))
        continue
      const rest = nodePath.slice(prefix.length)
      // Only direct children (no nested slashes)
      if (!rest || rest.includes('/'))
        continue

      if (!seen.has(rest)) {
        seen.add(rest)
        entries.push({
          name: rest,
          type: node.type,
          size: node.size,
          mtime: node.mtime,
          path: nodePath,
        })
      }
    }
    return entries
  }

  async exists(path: string): Promise<boolean> {
    return this.nodes.has(this.normalizePath(path))
  }

  async stat(path: string): Promise<FsEntry> {
    const p = this.normalizePath(path)
    const node = this.nodes.get(p)
    if (!node)
      throw new Error(`Not found: ${path}`)
    return {
      name: p.split('/').pop() ?? '',
      type: node.type,
      size: node.size,
      mtime: node.mtime,
      path: p,
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const p = this.normalizePath(path)
    this.ensureParentDirs(p)
    this.change(p, {
      type: 'file',
      content,
      mtime: Date.now(),
      size: new TextEncoder().encode(content).length,
    })
    this.schedulePersist()
  }

  async writeBlob(path: string, data: Blob): Promise<void> {
    const p = this.normalizePath(path)
    this.ensureParentDirs(p)
    this.change(p, {
      type: 'file',
      blob: data,
      mtime: Date.now(),
      size: data.size,
    })
    this.schedulePersist()
  }

  async mkdir(path: string): Promise<void> {
    const p = this.normalizePath(path)
    this.ensureParentDirs(p)
    if (!this.nodes.has(p)) {
      this.change(p, {
        type: 'directory',
        mtime: Date.now(),
        size: 0,
      })
      this.schedulePersist()
    }
  }

  async deleteFile(path: string): Promise<void> {
    const p = this.normalizePath(path)
    this.change(p)
    this.schedulePersist()
  }

  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const p = this.normalizePath(path)
    const prefix = `${p}/`
    if (options?.recursive === false && [...this.nodes.keys()].some(key => key.startsWith(prefix)))
      throw new DOMException('Directory is not empty', 'InvalidModificationError')
    const toDelete: string[] = [p]
    for (const key of this.nodes.keys()) {
      if (key.startsWith(prefix))
        toDelete.push(key)
    }
    for (const key of toDelete) this.change(key)
    this.schedulePersist()
  }

  async listFiles(subdir: string, ext: string): Promise<string[]> {
    const entries = await this.readdir(subdir)
    return entries
      .filter(e => e.type === 'file' && e.name.endsWith(ext))
      .map(e => e.path)
      .sort()
  }

  async listFilesByExts(subdir: string, exts: string[]): Promise<string[]> {
    const entries = await this.readdir(subdir)
    return entries
      .filter(e => e.type === 'file' && exts.some(ext => e.name.toLowerCase().endsWith(ext)))
      .map(e => e.path)
      .sort()
  }

  async collectAllFiles(basePath = ''): Promise<FsFileEntry[]> {
    const files: FsFileEntry[] = []
    const entries = await this.readdir(basePath)

    for (const entry of entries) {
      if (entry.type === 'file') {
        if (isTextFile(entry.name)) {
          try {
            const content = await this.readFile(entry.path)
            const node = this.nodes.get(this.normalizePath(entry.path))
            files.push({
              path: entry.path,
              content,
              lastModified: new Date(node?.mtime ?? Date.now()),
            })
          }
          catch { /* skip */ }
        }
      }
      else if (entry.type === 'directory') {
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
          continue
        files.push(...await this.collectAllFiles(entry.path))
      }
    }
    return files
  }

  /**
   * Bulk-load files into memory (e.g. from a template or imported .advpkg).
   * Does NOT trigger per-file persist; call persist() once after.
   */
  bulkLoad(files: Array<{ path: string, content: string }>): void {
    for (const f of files) {
      const p = this.normalizePath(f.path)
      this.ensureParentDirs(p)
      this.change(p, {
        type: 'file',
        content: f.content,
        mtime: Date.now(),
        size: new TextEncoder().encode(f.content).length,
      })
    }
  }
}
