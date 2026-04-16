import type { IFileSystem } from '../utils/fs'

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
 * Export a project as a `.advpkg.zip` file via IFileSystem.
 *
 * Collects all files under `adv/` directory, generates a manifest,
 * and packages everything into a downloadable zip.
 */
export async function exportProject(
  fs: IFileSystem,
  projectName: string,
): Promise<Blob> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()

  // Collect all text files under adv/
  let allFiles: { path: string, content: string }[]
  try {
    allFiles = await fs.collectAllFiles('adv')
  }
  catch {
    throw new Error('No adv/ directory found in project')
  }

  // Count stats
  let characters = 0
  let chapters = 0
  let scenes = 0
  let audios = 0
  let knowledge = 0

  for (const { path, content } of allFiles) {
    zip.file(path, content)

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

  // Also try to include binary files (images, audio) via blob URLs
  try {
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.wav', '.ogg', '.m4a']
    for (const ext of binaryExts) {
      try {
        const binaryFiles = await fs.listFilesByExts('adv', [ext])
        for (const binaryPath of binaryFiles) {
          if (zip.file(binaryPath))
            continue // already added as text
          try {
            const blobUrl = await fs.readBlobUrl(binaryPath)
            const resp = await fetch(blobUrl)
            const blob = await resp.blob()
            URL.revokeObjectURL(blobUrl)
            zip.file(binaryPath, blob)
          }
          catch { /* skip unreadable binary */ }
        }
      }
      catch { /* no files with this ext */ }
    }
  }
  catch { /* binary export best-effort */ }

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
 * Import a `.advpkg.zip` file into a project via IFileSystem.
 *
 * Reads the zip, validates manifest, and extracts all files.
 */
export async function importProject(
  zipFile: File,
  fs: IFileSystem,
): Promise<ProjectManifest> {
  const JSZip = (await import('jszip')).default
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
    // Ensure parent directories exist
    const dirParts = path.split('/')
    dirParts.pop() // remove filename
    if (dirParts.length > 0) {
      await fs.mkdir(dirParts.join('/'))
    }

    // Write file
    if (TEXT_FILE_RE.test(path)) {
      const text = await zipEntry.async('string')
      await fs.writeFile(path, text)
    }
    else {
      const blob = await zipEntry.async('blob')
      await fs.writeBlob(path, blob)
    }
  }

  return manifest
}
