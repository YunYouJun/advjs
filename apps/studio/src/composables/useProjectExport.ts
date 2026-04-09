import JSZip from 'jszip'
import { resolveSubdir } from '../utils/fileAccess'

const TEXT_FILE_RE = /\.(?:md|json|txt|yaml|yml|css|js|ts|html)$/i

interface ProjectManifest {
  name: string
  version: string
  exportedAt: string
  stats: {
    characters: number
    chapters: number
    scenes: number
    audios: number
    knowledge: number
  }
}

/**
 * Recursively collect all files under a directory handle into a Map<relativePath, content>.
 * Handles both text files and binary files (images, audio).
 */
async function collectFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
): Promise<Map<string, Blob | string>> {
  const files = new Map<string, Blob | string>()

  for await (const entry of dirHandle.values()) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.kind === 'file') {
      const fileHandle = await dirHandle.getFileHandle(entry.name)
      const file = await fileHandle.getFile()
      // Text files: md, json, txt, adv.md, yaml, yml, etc.
      if (TEXT_FILE_RE.test(entry.name)) {
        files.set(path, await file.text())
      }
      else {
        // Binary: images, audio, etc.
        files.set(path, file)
      }
    }
    else if (entry.kind === 'directory') {
      const subDir = await dirHandle.getDirectoryHandle(entry.name)
      const subFiles = await collectFiles(subDir, path)
      for (const [k, v] of subFiles) {
        files.set(k, v)
      }
    }
  }

  return files
}

/**
 * Export a project as a `.advpkg.zip` file.
 *
 * Collects all files under `adv/` directory, generates a manifest,
 * and packages everything into a downloadable zip.
 */
export async function exportProject(
  dirHandle: FileSystemDirectoryHandle,
  projectName: string,
): Promise<Blob> {
  const zip = new JSZip()

  // Collect files from adv/ directory
  let advDir: FileSystemDirectoryHandle
  try {
    advDir = await resolveSubdir(dirHandle, ['adv'])
  }
  catch {
    throw new Error('No adv/ directory found in project')
  }

  const files = await collectFiles(advDir, 'adv')

  // Count stats
  let characters = 0
  let chapters = 0
  let scenes = 0
  let audios = 0
  let knowledge = 0

  for (const [path, content] of files) {
    // Add to zip
    if (typeof content === 'string') {
      zip.file(path, content)
    }
    else {
      zip.file(path, content)
    }

    // Count by directory
    if (path.startsWith('adv/characters/'))
      characters++
    else if (path.startsWith('adv/chapters/'))
      chapters++
    else if (path.startsWith('adv/scenes/'))
      scenes++
    else if (path.startsWith('adv/audio/'))
      audios++
    else if (path.startsWith('adv/knowledge/'))
      knowledge++
  }

  // Generate manifest
  const manifest: ProjectManifest = {
    name: projectName,
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    stats: { characters, chapters, scenes, audios, knowledge },
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // Generate zip blob
  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

/**
 * Trigger browser download of a blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Import a `.advpkg.zip` file into a project directory.
 *
 * Reads the zip, validates manifest, and extracts all files to dirHandle.
 */
export async function importProject(
  zipFile: File,
  dirHandle: FileSystemDirectoryHandle,
): Promise<ProjectManifest> {
  const zip = await JSZip.loadAsync(zipFile)

  // Validate manifest
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile)
    throw new Error('Invalid .advpkg: no manifest.json found')

  const manifestText = await manifestFile.async('string')
  const manifest: ProjectManifest = JSON.parse(manifestText)

  if (!manifest.name || !manifest.version)
    throw new Error('Invalid manifest: missing name or version')

  // Extract all files (except manifest.json itself)
  const entries = Object.entries(zip.files).filter(([name]) => name !== 'manifest.json' && !name.endsWith('/'))

  for (const [path, zipEntry] of entries) {
    const parts = path.split('/')
    const fileName = parts.pop()!

    // Create directories
    let currentDir = dirHandle
    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true })
      }
      catch {
        currentDir = await currentDir.getDirectoryHandle(part)
      }
    }

    // Write file
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()

    // Determine if text or binary based on extension
    if (TEXT_FILE_RE.test(fileName)) {
      const text = await zipEntry.async('string')
      await writable.write(text)
    }
    else {
      const blob = await zipEntry.async('blob')
      await writable.write(blob)
    }

    await writable.close()
  }

  return manifest
}
