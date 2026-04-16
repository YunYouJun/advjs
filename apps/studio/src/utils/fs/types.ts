/**
 * Platform-agnostic file system interface.
 *
 * Abstracts away the underlying file system implementation so that
 * the same Studio code can run on:
 *   - Desktop Chromium (File System Access API)
 *   - iOS / Android native (Capacitor Filesystem plugin)
 *   - Safari / Firefox / fallback (in-memory + IndexedDB via OPFS)
 */

/** Metadata for a single file or directory entry */
export interface FsEntry {
  /** File or directory name (e.g. "chapter-01.adv.md") */
  name: string
  /** 'file' or 'directory' */
  type: 'file' | 'directory'
  /** File size in bytes (0 for directories) */
  size: number
  /** Last modification time in epoch milliseconds */
  mtime: number
  /** Full relative path from project root (e.g. "adv/chapters/chapter-01.adv.md") */
  path: string
}

/** A file entry with its text content */
export interface FsFileEntry {
  path: string
  content: string
  lastModified: Date
}

/**
 * Unified file system interface.
 *
 * All paths are **relative** to the project root (e.g. "adv/chapters/ch01.adv.md").
 * Implementations handle the mapping to their native path system.
 */
export interface IFileSystem {
  /** Human-readable backend name for debugging */
  readonly backend: 'browser' | 'capacitor' | 'memory'

  // --- Read operations ---

  /** Read a text file, returns its content as a UTF-8 string */
  readFile: (path: string) => Promise<string>

  /** Read a binary file, returns a Blob */
  readBlob: (path: string) => Promise<Blob>

  /** List entries (non-recursive) in a directory */
  readdir: (path: string) => Promise<FsEntry[]>

  /** Check if a file or directory exists */
  exists: (path: string) => Promise<boolean>

  /** Get metadata for a file or directory */
  stat: (path: string) => Promise<FsEntry>

  // --- Write operations ---

  /** Write a text file (creates parent directories as needed) */
  writeFile: (path: string, content: string) => Promise<void>

  /** Write a binary file (creates parent directories as needed) */
  writeBlob: (path: string, data: Blob) => Promise<void>

  /** Create a directory (recursive by default) */
  mkdir: (path: string) => Promise<void>

  // --- Delete operations ---

  /** Delete a file */
  deleteFile: (path: string) => Promise<void>

  /** Delete a directory (recursive) */
  rmdir: (path: string) => Promise<void>

  // --- Batch / utility ---

  /**
   * List files matching an extension in a subdirectory.
   * Returns relative paths from project root (e.g. "adv/chapters/ch01.adv.md").
   */
  listFiles: (subdir: string, ext: string) => Promise<string[]>

  /**
   * List files matching any of the given extensions in a subdirectory.
   */
  listFilesByExts: (subdir: string, exts: string[]) => Promise<string[]>

  /**
   * Recursively collect all text files from a directory.
   * Used for cloud sync and project export.
   */
  collectAllFiles: (basePath?: string) => Promise<FsFileEntry[]>

  /**
   * Get a blob URL for a binary file (for <img>, <audio>, <video> elements).
   * Caller is responsible for revoking the URL when done.
   */
  readBlobUrl: (path: string) => Promise<string>
}

/** Options for creating a file system instance */
export interface CreateFsOptions {
  /** Browser File System Access API directory handle */
  dirHandle?: FileSystemDirectoryHandle
  /** Capacitor project path (relative to Documents directory) */
  capacitorPath?: string
  /** Project ID for memory/OPFS backend */
  projectId?: string
}
