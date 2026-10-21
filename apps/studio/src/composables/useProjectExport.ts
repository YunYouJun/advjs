import type { ProjectPackageManifest } from '@advjs/core'
import type { IFileSystem } from '../utils/fs'
import { verifyVoiceCandidateBytes } from '@advjs/audio'
import {
  createProjectPackageManifest,
  isSafeProjectPackagePath,
  PROJECT_PACKAGE_MANIFEST_PATH,
  PROJECT_PACKAGE_VOICE_DESIGN_RE,
  projectPackageCatalogEntries,
  readProjectPackageManifest,
} from '@advjs/core'

const TEXT_FILE_RE = /\.(?:md|json|txt|yaml|yml|css|js|ts|html)$/i

type ProjectManifest = ProjectPackageManifest

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

  for (const { path, content } of allFiles)
    zip.file(path, content)

  // Keep the native format/entry and the reviewed voice library with the project.
  // Private runtime queues, access tokens and temporary preview files are outside
  // these finite authoring paths and are never part of this export.
  if (await fs.exists('adv.config.json'))
    zip.file('adv.config.json', await fs.readFile('adv.config.json'))
  if (await fs.exists('authoring/voices/library.json'))
    zip.file('authoring/voices/library.json', await fs.readFile('authoring/voices/library.json'))
  for (const file of await fs.collectAllFiles('authoring/voices/designs').catch(() => [])) {
    if (PROJECT_PACKAGE_VOICE_DESIGN_RE.test(file.path) && isSafeProjectPackagePath(file.path))
      zip.file(file.path, file.content)
  }

  // Catalog-backed audio may live under public/media rather than adv/. Keep
  // original sample/take identities and their bytes in a portable native project.
  if (await fs.exists('adv/assets.json')) {
    const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
    const catalog = await projectPackageCatalogEntries(files)
    for (const path of catalog.consents)
      zip.file(path, await fs.readFile(path))
    for (const source of catalog.media) {
      const blob = await fs.readBlob(source.path)
      if (source.sha256)
        await verifyVoiceCandidateBytes(source as { sha256: string, bytes?: number }, await blob.arrayBuffer())
      zip.file(source.path, await blob.arrayBuffer())
    }
  }

  // Also try to include binary files (images, audio) via blob URLs
  try {
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp3', '.wav', '.ogg', '.opus', '.webm', '.aac', '.m4a', '.flac']
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
  const manifest = createProjectPackageManifest(projectName, new Date().toISOString(), allFiles.map(file => file.path))

  zip.file(PROJECT_PACKAGE_MANIFEST_PATH, JSON.stringify(manifest, null, 2))

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
  const manifest = readProjectPackageManifest(await zip.file(PROJECT_PACKAGE_MANIFEST_PATH)?.async('string'))

  // Extract all files (except manifest.json itself)
  const entries = Object.entries(zip.files).filter(([name]) => name !== PROJECT_PACKAGE_MANIFEST_PATH && !name.endsWith('/'))
  const unsafe = entries.find(([name]) => !isSafeProjectPackagePath(name))
  if (unsafe)
    throw new Error(`Invalid .advpkg: unsafe path ${unsafe[0]}`)

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
