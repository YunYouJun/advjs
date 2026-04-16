/**
 * File system utility functions and constants.
 *
 * Consolidated from the former `fileAccess.ts` — all file-type detection,
 * extension constants, browser download helpers, and directory picker
 * utilities now live here as the single source of truth.
 */

// ── Extension constants ──

export const TEXT_EXTENSIONS = new Set([
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

export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.webm', '.flac', '.aac']

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.avif']

// ── File type detection ──

/** Check if a filename is likely a text file */
export function isTextFile(name: string): boolean {
  return Array.from(TEXT_EXTENSIONS).some(ext => name.endsWith(ext))
}

/** Check if a filename is an audio file */
export function isAudioFile(name: string): boolean {
  const lower = name.toLowerCase()
  return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext))
}

/** Check if a filename is an image file */
export function isImageFile(name: string): boolean {
  const lower = name.toLowerCase()
  return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext))
}

// ── Browser utilities ──

/**
 * Trigger a browser file download from in-memory content.
 */
export function downloadAsFile(
  content: string,
  filename: string,
  type = 'text/markdown',
): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Open a directory picker and return the handle (browser-only) */
export async function openProjectDirectory(): Promise<FileSystemDirectoryHandle> {
  const dirHandle = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
  })
  return dirHandle
}

/** Detect whether the directory is an ADV.JS project */
export async function detectAdvProject(
  dir: FileSystemDirectoryHandle,
): Promise<{ isValid: boolean, advDir: string, name: string }> {
  const result = { isValid: false, advDir: '', name: dir.name }

  // Check for adv/ subdirectory
  try {
    await dir.getDirectoryHandle('adv')
    result.isValid = true
    result.advDir = 'adv'
    return result
  }
  catch {
    // no adv/ dir
  }

  // Check for adv.config.json or adv.config.ts
  try {
    await dir.getFileHandle('adv.config.json')
    result.isValid = true
    return result
  }
  catch {
    // no config file
  }

  try {
    await dir.getFileHandle('adv.config.ts')
    result.isValid = true
    return result
  }
  catch {
    // no config file
  }

  // Check for any .adv.md files in root
  try {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.adv.md')) {
        result.isValid = true
        return result
      }
    }
  }
  catch {
    // iteration error
  }

  return result
}
