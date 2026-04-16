/**
 * Factory for creating the appropriate IFileSystem adapter
 * based on the current runtime environment and project configuration.
 *
 * Selection logic:
 *   1. If a FileSystemDirectoryHandle is available → BrowserFsAdapter
 *   2. If running on a native Capacitor platform → CapacitorFsAdapter
 *   3. Otherwise → MemoryFsAdapter (IndexedDB-persisted in-memory FS)
 */

import type { CreateFsOptions, IFileSystem } from './types'

/** Detect if running on a Capacitor native platform (iOS/Android) */
function isNativePlatform(): boolean {
  try {
    // Capacitor injects this global. Avoid importing @capacitor/core at module level
    // so the factory can run even without Capacitor installed.
    const w = window as any
    return w?.Capacitor?.isNativePlatform?.() === true
  }
  catch {
    return false
  }
}

/** Detect if the browser supports File System Access API (showDirectoryPicker) */
export function supportsFileSystemAccess(): boolean {
  try {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  }
  catch {
    return false
  }
}

/**
 * Create a file system adapter for the given project configuration.
 *
 * @example
 * ```ts
 * // Desktop Chrome with a local directory handle
 * const fs = createFileSystem({ dirHandle })
 *
 * // iOS native app
 * const fs = createFileSystem({ capacitorPath: 'advjs/my-project' })
 *
 * // Safari / Firefox fallback
 * const fs = await createFileSystem({ projectId: 'my-project-slug' })
 * ```
 */
export async function createFileSystem(options: CreateFsOptions): Promise<IFileSystem> {
  // Priority 1: Browser File System Access API (has a dirHandle)
  if (options.dirHandle) {
    const { BrowserFsAdapter } = await import('./BrowserFsAdapter')
    return new BrowserFsAdapter(options.dirHandle)
  }

  // Priority 2: Capacitor native platform
  if (isNativePlatform() && options.capacitorPath) {
    const { CapacitorFsAdapter } = await import('./CapacitorFsAdapter')
    return new CapacitorFsAdapter(options.capacitorPath)
  }

  // Priority 3: Native platform without explicit path → derive from projectId
  if (isNativePlatform() && options.projectId) {
    const { CapacitorFsAdapter } = await import('./CapacitorFsAdapter')
    return new CapacitorFsAdapter(`advjs/${options.projectId}`)
  }

  // Priority 4: Memory fallback (Safari, Firefox, other browsers)
  const { MemoryFsAdapter } = await import('./MemoryFsAdapter')
  const memFs = new MemoryFsAdapter(options.projectId ?? '_default_')
  await memFs.init()
  return memFs
}

/**
 * Create a file system adapter for a StudioProject.
 *
 * Convenience wrapper that maps StudioProject fields to CreateFsOptions.
 */
export async function createFsForProject(project: {
  dirHandle?: FileSystemDirectoryHandle
  projectId: string
  source?: 'local' | 'url' | 'cos'
}): Promise<IFileSystem> {
  return createFileSystem({
    dirHandle: project.dirHandle,
    projectId: project.projectId,
    capacitorPath: isNativePlatform() ? `advjs/${project.projectId}` : undefined,
  })
}
