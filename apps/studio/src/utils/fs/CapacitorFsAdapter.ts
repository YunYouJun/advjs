/**
 * File system adapter backed by @capacitor/filesystem.
 *
 * Works on iOS and Android native apps via Capacitor.
 * Projects are stored under `Documents/advjs/{projectId}/`.
 *
 * Key design decisions:
 *   - Uses Directory.Documents so files are visible in iOS Files app
 *   - All reads/writes use Encoding.UTF8 for text, base64 for blobs
 *   - readdir is non-recursive (matches browser API); collectAllFiles recurses manually
 */

import type { FsEntry, FsFileEntry, IFileSystem } from './types'
import { isTextFile } from './utils'

const LEADING_SLASHES_RE = /^\/+/

/**
 * Lazily import @capacitor/filesystem to avoid bundling it in web-only builds.
 * Returns { Filesystem, Directory, Encoding } from the plugin.
 */
async function getCapFs() {
  const mod = await import('@capacitor/filesystem')
  return {
    Filesystem: mod.Filesystem,
    Directory: mod.Directory,
    Encoding: mod.Encoding,
  }
}

export class CapacitorFsAdapter implements IFileSystem {
  readonly backend = 'capacitor' as const

  /**
   * @param basePath — project root relative to Documents, e.g. "advjs/my-project"
   */
  constructor(private basePath: string) {}

  private resolvePath(relative: string): string {
    const clean = relative.replace(LEADING_SLASHES_RE, '')
    return clean ? `${this.basePath}/${clean}` : this.basePath
  }

  // --- IFileSystem implementation ---

  async readFile(path: string): Promise<string> {
    const { Filesystem, Directory, Encoding } = await getCapFs()
    const result = await Filesystem.readFile({
      path: this.resolvePath(path),
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    })
    // On native, data is always a string when encoding is specified
    return result.data as string
  }

  async readBlob(path: string): Promise<Blob> {
    const { Filesystem, Directory } = await getCapFs()
    // Read without encoding → returns base64
    const result = await Filesystem.readFile({
      path: this.resolvePath(path),
      directory: Directory.Documents,
    })
    const base64 = result.data as string
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes])
  }

  async readBlobUrl(path: string): Promise<string> {
    const blob = await this.readBlob(path)
    return URL.createObjectURL(blob)
  }

  async readdir(path: string): Promise<FsEntry[]> {
    const { Filesystem, Directory } = await getCapFs()
    const result = await Filesystem.readdir({
      path: this.resolvePath(path),
      directory: Directory.Documents,
    })
    return result.files.map(f => ({
      name: f.name,
      type: f.type as 'file' | 'directory',
      size: f.size ?? 0,
      mtime: f.mtime ?? 0,
      path: path ? `${path}/${f.name}` : f.name,
    }))
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path)
      return true
    }
    catch {
      return false
    }
  }

  async stat(path: string): Promise<FsEntry> {
    const { Filesystem, Directory } = await getCapFs()
    const result = await Filesystem.stat({
      path: this.resolvePath(path),
      directory: Directory.Documents,
    })
    return {
      name: result.name ?? path.split('/').pop() ?? '',
      type: result.type as 'file' | 'directory',
      size: result.size ?? 0,
      mtime: result.mtime ?? 0,
      path,
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { Filesystem, Directory, Encoding } = await getCapFs()
    await Filesystem.writeFile({
      path: this.resolvePath(path),
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    })
  }

  async writeBlob(path: string, data: Blob): Promise<void> {
    const { Filesystem, Directory } = await getCapFs()
    // Convert Blob to base64
    const buffer = await data.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    await Filesystem.writeFile({
      path: this.resolvePath(path),
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    })
  }

  async mkdir(path: string): Promise<void> {
    const { Filesystem, Directory } = await getCapFs()
    await Filesystem.mkdir({
      path: this.resolvePath(path),
      directory: Directory.Documents,
      recursive: true,
    })
  }

  async deleteFile(path: string): Promise<void> {
    const { Filesystem, Directory } = await getCapFs()
    await Filesystem.deleteFile({
      path: this.resolvePath(path),
      directory: Directory.Documents,
    })
  }

  async rmdir(path: string): Promise<void> {
    const { Filesystem, Directory } = await getCapFs()
    await Filesystem.rmdir({
      path: this.resolvePath(path),
      directory: Directory.Documents,
      recursive: true,
    })
  }

  async listFiles(subdir: string, ext: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await this.readdir(subdir)
      for (const entry of entries) {
        if (entry.type === 'file' && entry.name.endsWith(ext)) {
          files.push(entry.path)
        }
      }
    }
    catch {
      // directory not found
    }
    return files.sort()
  }

  async listFilesByExts(subdir: string, exts: string[]): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await this.readdir(subdir)
      for (const entry of entries) {
        if (entry.type === 'file' && exts.some(ext => entry.name.toLowerCase().endsWith(ext))) {
          files.push(entry.path)
        }
      }
    }
    catch {
      // directory not found
    }
    return files.sort()
  }

  async collectAllFiles(basePath = ''): Promise<FsFileEntry[]> {
    const files: FsFileEntry[] = []
    try {
      const entries = await this.readdir(basePath)
      for (const entry of entries) {
        if (entry.type === 'file') {
          if (isTextFile(entry.name)) {
            try {
              const content = await this.readFile(entry.path)
              const stat = await this.stat(entry.path)
              files.push({
                path: entry.path,
                content,
                lastModified: new Date(stat.mtime),
              })
            }
            catch { /* skip unreadable */ }
          }
        }
        else if (entry.type === 'directory') {
          if (entry.name.startsWith('.') || entry.name === 'node_modules')
            continue
          try {
            files.push(...await this.collectAllFiles(entry.path))
          }
          catch { /* skip inaccessible */ }
        }
      }
    }
    catch { /* directory not found */ }
    return files
  }
}
