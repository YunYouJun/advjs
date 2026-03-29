/**
 * File System Access API utilities for browser-based project management.
 * Uses the File System Access API (showDirectoryPicker).
 */

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
  let current: FileSystemDirectoryHandle = dir

  // Navigate to subdirectories
  for (let i = 0; i < parts.length - 1; i++)
    current = await current.getDirectoryHandle(parts[i])

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
      const parts = subdir.split('/').filter(Boolean)
      for (const part of parts)
        targetDir = await targetDir.getDirectoryHandle(part)
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
  let current: FileSystemDirectoryHandle = dir

  // Navigate/create subdirectories
  for (let i = 0; i < parts.length - 1; i++)
    current = await current.getDirectoryHandle(parts[i], { create: true })

  const fileName = parts.at(-1)!
  const fileHandle = await current.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}
