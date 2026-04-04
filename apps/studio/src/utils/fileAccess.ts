/**
 * File System Access API utilities for browser-based project management.
 * Uses the File System Access API (showDirectoryPicker).
 */

/** Navigate into nested subdirectories from a root handle */
export async function resolveSubdir(
  dir: FileSystemDirectoryHandle,
  parts: string[],
  create = false,
): Promise<FileSystemDirectoryHandle> {
  let current = dir
  for (const part of parts)
    current = await current.getDirectoryHandle(part, create ? { create: true } : undefined)
  return current
}

/** Open a directory picker and return the handle */
export async function openProjectDirectory(): Promise<FileSystemDirectoryHandle> {
  const dirHandle = await (window as any).showDirectoryPicker({
    mode: 'readwrite',
  })
  return dirHandle
}

/** Read a file from a directory handle by relative path */
export async function readFileFromDir(
  dir: FileSystemDirectoryHandle,
  path: string,
): Promise<string> {
  const parts = path.split('/').filter(Boolean)
  const current = await resolveSubdir(dir, parts.slice(0, -1))
  const fileName = parts.at(-1)!
  const fileHandle = await current.getFileHandle(fileName)
  const file = await fileHandle.getFile()
  return file.text()
}

/** List files in a subdirectory matching an extension */
export async function listFilesInDir(
  dir: FileSystemDirectoryHandle,
  subdir: string,
  ext: string,
): Promise<string[]> {
  const files: string[] = []

  try {
    let targetDir: FileSystemDirectoryHandle = dir
    if (subdir) {
      targetDir = await resolveSubdir(dir, subdir.split('/').filter(Boolean))
    }

    for await (const entry of targetDir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith(ext))
        files.push(subdir ? `${subdir}/${entry.name}` : entry.name)
    }
  }
  catch {
    // directory not found
  }

  return files.sort()
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

/** Write content to a file in a directory handle */
export async function writeFileToDir(
  dir: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  const current = await resolveSubdir(dir, parts.slice(0, -1), true)
  const fileName = parts.at(-1)!
  const fileHandle = await current.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

/**
 * Trigger a browser file download from in-memory content.
 * Complements `writeFileToDir` (which writes to the File System Access API).
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

const TEXT_EXTENSIONS = [
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
]

/** Check if a filename is likely a text file */
export function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.some(ext => name.endsWith(ext))
}

/** Collect all files from a local directory handle recursively (text files only) */
export async function collectLocalFiles(
  dirHandle: FileSystemDirectoryHandle,
  basePath = '',
): Promise<{ path: string, content: string, lastModified: Date }[]> {
  const files: { path: string, content: string, lastModified: Date }[] = []

  try {
    for await (const entry of dirHandle.values()) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name

      if (entry.kind === 'file') {
        try {
          const fileHandle = await dirHandle.getFileHandle(entry.name)
          const file = await fileHandle.getFile()
          if (isTextFile(entry.name)) {
            const content = await file.text()
            files.push({
              path: entryPath,
              content,
              lastModified: new Date(file.lastModified),
            })
          }
        }
        catch {
          // skip unreadable files
        }
      }
      else if (entry.kind === 'directory') {
        if (entry.name.startsWith('.') || entry.name === 'node_modules')
          continue

        try {
          const subDir = await dirHandle.getDirectoryHandle(entry.name)
          const subFiles = await collectLocalFiles(subDir, entryPath)
          files.push(...subFiles)
        }
        catch {
          // skip inaccessible directories
        }
      }
    }
  }
  catch {
    // iteration error
  }

  return files
}
