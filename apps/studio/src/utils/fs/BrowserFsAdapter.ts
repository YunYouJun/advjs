/**
 * File system adapter backed by the browser File System Access API.
 *
 * Wraps `FileSystemDirectoryHandle` and friends. Only works on
 * desktop Chromium (Chrome / Edge 86+).
 */

import type { FsEntry, FsFileEntry, IFileSystem } from './types'

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

export class BrowserFsAdapter implements IFileSystem {
  readonly backend = 'browser' as const

  constructor(private root: FileSystemDirectoryHandle) {}

  /** Get the underlying directory handle (for legacy code that still needs it) */
  get dirHandle(): FileSystemDirectoryHandle {
    return this.root
  }

  // --- internal helpers ---

  private async resolveSubdir(
    dir: FileSystemDirectoryHandle,
    parts: string[],
    create = false,
  ): Promise<FileSystemDirectoryHandle> {
    let current = dir
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, create ? { create: true } : undefined)
    }
    return current
  }

  private splitPath(path: string): { dir: string[], file: string } {
    const parts = path.split('/').filter(Boolean)
    return { dir: parts.slice(0, -1), file: parts.at(-1)! }
  }

  // --- IFileSystem implementation ---

  async readFile(path: string): Promise<string> {
    const { dir, file } = this.splitPath(path)
    const parent = await this.resolveSubdir(this.root, dir)
    const handle = await parent.getFileHandle(file)
    const f = await handle.getFile()
    return f.text()
  }

  async readBlob(path: string): Promise<Blob> {
    const { dir, file } = this.splitPath(path)
    const parent = await this.resolveSubdir(this.root, dir)
    const handle = await parent.getFileHandle(file)
    return handle.getFile()
  }

  async readBlobUrl(path: string): Promise<string> {
    const blob = await this.readBlob(path)
    return URL.createObjectURL(blob)
  }

  async readdir(path: string): Promise<FsEntry[]> {
    const parts = path.split('/').filter(Boolean)
    const dir = parts.length > 0
      ? await this.resolveSubdir(this.root, parts)
      : this.root

    const entries: FsEntry[] = []
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const handle = await dir.getFileHandle(entry.name)
        const file = await handle.getFile()
        entries.push({
          name: entry.name,
          type: 'file',
          size: file.size,
          mtime: file.lastModified,
          path: path ? `${path}/${entry.name}` : entry.name,
        })
      }
      else {
        entries.push({
          name: entry.name,
          type: 'directory',
          size: 0,
          mtime: 0,
          path: path ? `${path}/${entry.name}` : entry.name,
        })
      }
    }
    return entries
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
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) {
      return { name: this.root.name, type: 'directory', size: 0, mtime: 0, path: '' }
    }

    const parentParts = parts.slice(0, -1)
    const name = parts.at(-1)!
    const parent = parentParts.length > 0
      ? await this.resolveSubdir(this.root, parentParts)
      : this.root

    // Try as file first
    try {
      const handle = await parent.getFileHandle(name)
      const file = await handle.getFile()
      return { name, type: 'file', size: file.size, mtime: file.lastModified, path }
    }
    catch {
      // Try as directory
      await parent.getDirectoryHandle(name)
      return { name, type: 'directory', size: 0, mtime: 0, path }
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const { dir, file } = this.splitPath(path)
    const parent = await this.resolveSubdir(this.root, dir, true)
    const handle = await parent.getFileHandle(file, { create: true })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async writeBlob(path: string, data: Blob): Promise<void> {
    const { dir, file } = this.splitPath(path)
    const parent = await this.resolveSubdir(this.root, dir, true)
    const handle = await parent.getFileHandle(file, { create: true })
    const writable = await handle.createWritable()
    await writable.write(data)
    await writable.close()
  }

  async mkdir(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean)
    await this.resolveSubdir(this.root, parts, true)
  }

  async deleteFile(path: string): Promise<void> {
    const { dir, file } = this.splitPath(path)
    const parent = dir.length > 0
      ? await this.resolveSubdir(this.root, dir)
      : this.root
    await parent.removeEntry(file)
  }

  async rmdir(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0)
      return
    const parentParts = parts.slice(0, -1)
    const name = parts.at(-1)!
    const parent = parentParts.length > 0
      ? await this.resolveSubdir(this.root, parentParts)
      : this.root
    await parent.removeEntry(name, { recursive: true })
  }

  async listFiles(subdir: string, ext: string): Promise<string[]> {
    const files: string[] = []
    try {
      const parts = subdir.split('/').filter(Boolean)
      const dir = parts.length > 0
        ? await this.resolveSubdir(this.root, parts)
        : this.root

      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith(ext)) {
          files.push(subdir ? `${subdir}/${entry.name}` : entry.name)
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
      const parts = subdir.split('/').filter(Boolean)
      const dir = parts.length > 0
        ? await this.resolveSubdir(this.root, parts)
        : this.root

      for await (const entry of dir.values()) {
        if (entry.kind === 'file' && exts.some(ext => entry.name.toLowerCase().endsWith(ext))) {
          files.push(subdir ? `${subdir}/${entry.name}` : entry.name)
        }
      }
    }
    catch {
      // directory not found
    }
    return files.sort()
  }

  async collectAllFiles(basePath = ''): Promise<FsFileEntry[]> {
    const dir = basePath
      ? await this.resolveSubdir(this.root, basePath.split('/').filter(Boolean))
      : this.root
    return this._collectRecursive(dir, basePath)
  }

  private async _collectRecursive(
    dir: FileSystemDirectoryHandle,
    basePath: string,
  ): Promise<FsFileEntry[]> {
    const files: FsFileEntry[] = []
    try {
      for await (const entry of dir.values()) {
        const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name

        if (entry.kind === 'file') {
          try {
            const handle = await dir.getFileHandle(entry.name)
            const file = await handle.getFile()
            if (isTextFile(entry.name)) {
              files.push({
                path: entryPath,
                content: await file.text(),
                lastModified: new Date(file.lastModified),
              })
            }
          }
          catch { /* skip unreadable */ }
        }
        else if (entry.kind === 'directory') {
          if (entry.name.startsWith('.') || entry.name === 'node_modules')
            continue
          try {
            const subDir = await dir.getDirectoryHandle(entry.name)
            files.push(...await this._collectRecursive(subDir, entryPath))
          }
          catch { /* skip inaccessible */ }
        }
      }
    }
    catch { /* iteration error */ }
    return files
  }
}
