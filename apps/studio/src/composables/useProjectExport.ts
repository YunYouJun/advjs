import type { IFileSystem } from '../utils/fs'
import { audioProjectMediaPath, parseVoiceDesignLibrary, verifyVoiceCandidateBytes } from '@advjs/audio'
import { compileProject } from '@advjs/core'

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

  // Keep the native format/entry and the reviewed voice library with the project.
  // Private runtime queues, access tokens and temporary preview files are outside
  // these finite authoring paths and are never part of this export.
  if (await fs.exists('adv.config.json'))
    zip.file('adv.config.json', await fs.readFile('adv.config.json'))
  if (await fs.exists('authoring/voices/library.json'))
    zip.file('authoring/voices/library.json', await fs.readFile('authoring/voices/library.json'))
  for (const file of await fs.collectAllFiles('authoring/voices/designs').catch(() => [])) {
    if (/^authoring\/voices\/designs\/[\w.-]+\/[\w.-]+\/[\w-]+\/[\w.-]+\.json$/u.test(file.path) && !file.path.split('/').some(part => ['.', '..', '.git', 'node_modules'].includes(part)))
      zip.file(file.path, file.content)
  }

  // Catalog-backed audio may live under public/media rather than adv/. Keep
  // original sample/take identities and their bytes in a portable native project.
  if (await fs.exists('adv/assets.json')) {
    const files = Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content]))
    const { project } = await compileProject({ files }, { allowEmptyAssetManifest: true })
    const consents = new Set<string>()
    function collectConsents(value: unknown) {
      if (!value || typeof value !== 'object')
        return
      for (const [key, child] of Object.entries(value)) {
        if (key === 'consentRecord' && typeof child === 'string')
          consents.add(child)
        else collectConsents(child)
      }
    }
    collectConsents(project.characters)
    for (const path of ['adv/audio/voice-ledger.json', 'adv/audio/voice-profiles.json']) {
      if (files[path])
        collectConsents(JSON.parse(files[path]))
    }
    if (files['authoring/voices/library.json'])
      collectConsents(parseVoiceDesignLibrary(files['authoring/voices/library.json']))
    for (const path of consents) {
      if (!/^(?!\/)(?!.*\\)(?!.*(?:^|\/)(?:\.|\.\.|\.git|node_modules)(?:\/|$))[\w./-]+\.(?:txt|md|json)$/u.test(path))
        throw new Error('VOICE_DESIGN_CONSENT_PATH_INVALID')
      zip.file(path, await fs.readFile(path))
    }
    for (const asset of project.assets?.assets ?? []) {
      if (asset.type !== 'audio' || !asset.path)
        continue
      const media = [{ path: asset.path, sha256: asset.sha256, bytes: asset.bytes }, ...Object.values(asset.variants ?? {}).filter(variant => variant.path)]
      for (const source of media) {
        const path = audioProjectMediaPath(project.assets!, { ...asset, path: source.path })
        const blob = await fs.readBlob(path)
        if (source.sha256)
          await verifyVoiceCandidateBytes(source as { sha256: string, bytes?: number }, await blob.arrayBuffer())
        zip.file(path, await blob.arrayBuffer())
      }
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
