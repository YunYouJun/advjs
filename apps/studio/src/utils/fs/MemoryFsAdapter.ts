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

import type { FsEntry, FsFileEntry, IFileSystem } from './types'

const TRIM_SLASHES_RE = /^\/+|\/+$/g
const MULTI_SLASH_RE = /\/+/g

const TEXT_EXTENSIONS = new Set([
  '.md',
  '.adv.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.ts',
  '.js',
  '.vue',
  '.css',
  '.html',
  '.xml',
  '.toml',
  '.ini',
  '.cfg',
  '.conf',
])

function isTextFile(name: string): boolean {
  return Array.from(TEXT_EXTENSIONS).some(ext => name.endsWith(ext))
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

export class MemoryFsAdapter implements IFileSystem {
  readonly backend = 'memory' as const

  /** path → FsNode */
  private nodes = new Map<string, FsNode>()
  private projectId: string
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(projectId: string) {
    this.projectId = projectId
  }

  /**
   * Load file system state from IndexedDB.
   * Call once after construction.
   */
  async init(): Promise<void> {
    try {
      const { db } = await import('../db')
      const prefix = `memfs:${this.projectId}:`
      const rows = await db.table('memfsNodes')
        .where('key')
        .startsWith(prefix)
        .toArray()
      for (const row of rows) {
        const path = row.key.slice(prefix.length)
        this.nodes.set(path, {
          type: row.type,
          content: row.content,
          mtime: row.mtime,
          size: row.size,
        })
      }
    }
    catch {
      // memfsNodes table may not exist yet; that's fine, we start empty
    }
  }

  /** Schedule a debounced persist to IndexedDB */
  private schedulePersist(): void {
    if (this.persistTimer)
      clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => this.persist(), 500)
  }

  /** Flush all nodes to IndexedDB */
  async persist(): Promise<void> {
    try {
      const { db } = await import('../db')
      const table = db.table('memfsNodes')
      const prefix = `memfs:${this.projectId}:`

      // Clear existing entries for this project
      const existingKeys = await table
        .where('key')
        .startsWith(prefix)
        .primaryKeys()
      if (existingKeys.length > 0) {
        await table.bulkDelete(existingKeys as string[])
      }

      // Write all current nodes
      const rows = Array.from(this.nodes.entries(), ([path, node]) => ({
        key: dbKey(this.projectId, path),
        type: node.type,
        content: node.content ?? '',
        mtime: node.mtime,
        size: node.size,
      }))
      if (rows.length > 0) {
        await table.bulkPut(rows)
      }
    }
    catch {
      // persist failure is non-fatal
    }
  }

  // --- helpers ---

  private normalizePath(path: string): string {
    return path.replace(TRIM_SLASHES_RE, '').replace(MULTI_SLASH_RE, '/')
  }

  private ensureParentDirs(path: string): void {
    const parts = path.split('/').filter(Boolean)
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      if (!this.nodes.has(dirPath)) {
        this.nodes.set(dirPath, {
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
    this.nodes.set(p, {
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
    this.nodes.set(p, {
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
      this.nodes.set(p, {
        type: 'directory',
        mtime: Date.now(),
        size: 0,
      })
      this.schedulePersist()
    }
  }

  async deleteFile(path: string): Promise<void> {
    const p = this.normalizePath(path)
    this.nodes.delete(p)
    this.schedulePersist()
  }

  async rmdir(path: string): Promise<void> {
    const p = this.normalizePath(path)
    const prefix = `${p}/`
    const toDelete: string[] = [p]
    for (const key of this.nodes.keys()) {
      if (key.startsWith(prefix))
        toDelete.push(key)
    }
    for (const key of toDelete) this.nodes.delete(key)
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
      this.nodes.set(p, {
        type: 'file',
        content: f.content,
        mtime: Date.now(),
        size: new TextEncoder().encode(f.content).length,
      })
    }
  }
}
