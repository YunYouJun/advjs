/**
 * File System Compatibility Layer
 *
 * Provides a unified IFileSystem interface that works across:
 *   - Desktop Chromium (File System Access API)
 *   - iOS / Android (Capacitor Filesystem plugin)
 *   - Safari / Firefox (in-memory + IndexedDB fallback)
 *
 * Usage:
 *   import { createFileSystem, createFsForProject } from '../utils/fs'
 */

// Adapters are dynamically imported by createFs.ts to keep bundle small.
// Export types only for external use if needed.
export type { BrowserFsAdapter } from './BrowserFsAdapter'

export type { CapacitorFsAdapter } from './CapacitorFsAdapter'

export {
  createFileSystem,
  createFsForProject,
  supportsFileSystemAccess,
} from './createFs'
export type { MemoryFsAdapter } from './MemoryFsAdapter'
export type {
  CreateFsOptions,
  FsEntry,
  FsFileEntry,
  IFileSystem,
} from './types'
