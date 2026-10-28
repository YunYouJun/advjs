/**
 * Portable project packages (`.advpkg.zip`): a `manifest.json` plus project
 * files at their project-relative paths. Studio hosts share these rules so a
 * package exported on one client imports on another.
 */

import type { AdvProjectFileMap } from '@advjs/types'
import { audioProjectMediaPath, parseVoiceDesignLibrary } from '@advjs/audio'
import { compileProject } from './compile'

export const PROJECT_PACKAGE_MANIFEST_PATH = 'manifest.json'
export const PROJECT_PACKAGE_EXTENSION = '.advpkg.zip'

/** Reviewed voice designs that travel with a project. */
export const PROJECT_PACKAGE_VOICE_DESIGN_RE = /^authoring\/voices\/designs\/[\w.-]+\/[\w.-]+\/[\w-]+\/[\w.-]+\.json$/u
const CONSENT_PATH_RE = /^(?!\/)(?!.*\\)(?!.*(?:^|\/)(?:\.|\.\.|\.git|node_modules)(?:\/|$))[\w./-]+\.(?:txt|md|json)$/u
const UNSAFE_SEGMENTS = new Set(['', '.', '..', '.git', 'node_modules'])

export interface ProjectPackageManifest {
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

export interface ProjectPackageEntry {
  path: string
  /** Expected digest of binary media; hosts verify bytes before packaging. */
  sha256?: string
  bytes?: number
}

/**
 * Manifest for a package whose `adv/` text files are `advTextPaths`; counts
 * follow the content directories, as Web Studio has always written them.
 */
export function createProjectPackageManifest(
  name: string,
  exportedAt: string,
  advTextPaths: readonly string[],
): ProjectPackageManifest {
  const stats = { characters: 0, chapters: 0, scenes: 0, audios: 0, knowledge: 0 }
  for (const path of advTextPaths) {
    if (path.startsWith('adv/characters/'))
      stats.characters++
    else if (path.startsWith('adv/chapters/'))
      stats.chapters++
    else if (path.startsWith('adv/scenes/'))
      stats.scenes++
    else if (path.startsWith('adv/audio/'))
      stats.audios++
    else if (path.startsWith('adv/knowledge/'))
      stats.knowledge++
  }
  return { name, version: '1.0.0', exportedAt, stats }
}

/** Parse `manifest.json`; throws for packages that are not ADV.JS projects. */
export function readProjectPackageManifest(text: string | undefined): ProjectPackageManifest {
  if (text === undefined)
    throw new Error('Invalid .advpkg: no manifest.json found')
  let manifest: ProjectPackageManifest
  try {
    manifest = JSON.parse(text)
  }
  catch {
    // Parser messages differ between JavaScript engines.
    throw new Error('Invalid manifest: not valid JSON')
  }
  if (!manifest || typeof manifest !== 'object' || !manifest.name || !manifest.version)
    throw new Error('Invalid manifest: missing name or version')
  return manifest
}

/**
 * Whether an archive entry may be written into a project: relative, no
 * backslashes or drive letters, and no empty, dot, `.git` or `node_modules`
 * segments.
 */
export function isSafeProjectPackagePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[a-z]:/iu.test(path))
    return false
  return path.split('/').every(segment => !UNSAFE_SEGMENTS.has(segment.toLowerCase()))
}

function collectConsents(value: unknown, consents: Set<string>): void {
  if (!value || typeof value !== 'object')
    return
  for (const [key, child] of Object.entries(value)) {
    if (key === 'consentRecord' && typeof child === 'string')
      consents.add(child)
    else
      collectConsents(child, consents)
  }
}

/**
 * Files a catalog-backed project needs beyond `adv/`: voice consent records
 * (text) and every audio master and variant the asset manifest references
 * (binary, with expected digests). Empty when the project has no catalog.
 */
export async function projectPackageCatalogEntries(files: Readonly<AdvProjectFileMap>): Promise<{
  consents: string[]
  media: ProjectPackageEntry[]
}> {
  if (files['adv/assets.json'] === undefined)
    return { consents: [], media: [] }
  const { project } = await compileProject({ files: { ...files } }, { allowEmptyAssetManifest: true })
  const consents = new Set<string>()
  collectConsents(project.characters, consents)
  for (const path of ['adv/audio/voice-ledger.json', 'adv/audio/voice-profiles.json']) {
    if (files[path])
      collectConsents(JSON.parse(files[path]), consents)
  }
  if (files['authoring/voices/library.json'])
    collectConsents(parseVoiceDesignLibrary(files['authoring/voices/library.json']), consents)
  for (const path of consents) {
    if (!CONSENT_PATH_RE.test(path))
      throw new Error('VOICE_DESIGN_CONSENT_PATH_INVALID')
  }

  const media: ProjectPackageEntry[] = []
  for (const asset of project.assets?.assets ?? []) {
    if (asset.type !== 'audio' || !asset.path)
      continue
    const sources = [{ path: asset.path, sha256: asset.sha256, bytes: asset.bytes }, ...Object.values(asset.variants ?? {}).filter(variant => variant.path)]
    for (const source of sources) {
      media.push({
        path: audioProjectMediaPath(project.assets!, { ...asset, path: source.path }),
        ...(source.sha256 ? { sha256: source.sha256 } : {}),
        ...(source.bytes !== undefined ? { bytes: source.bytes } : {}),
      })
    }
  }
  return { consents: [...consents], media }
}

export interface PlanProjectPackageInput {
  /** Text files keyed by project-relative path. */
  files: Readonly<AdvProjectFileMap>
  /** Every project-relative path, text and binary. */
  paths: readonly string[]
  name: string
  /** ISO timestamp written into the manifest. */
  exportedAt: string
}

export interface ProjectPackagePlan {
  manifest: ProjectPackageManifest
  /** Archive entries besides `manifest.json`, sorted by path. */
  entries: ProjectPackageEntry[]
}

/**
 * Everything a host writes into a package: all of `adv/` (text and media),
 * the project config, reviewed voice designs, and catalog-referenced voice
 * consents and audio outside `adv/`. Private queues, caches and preview
 * files are never included.
 */
export async function planProjectPackage(input: PlanProjectPackageInput): Promise<ProjectPackagePlan> {
  const entries = new Map<string, ProjectPackageEntry>()
  const add = (entry: ProjectPackageEntry) => {
    if (isSafeProjectPackagePath(entry.path))
      entries.set(entry.path, { ...entries.get(entry.path), ...entry })
  }
  const paths = [...new Set([...input.paths, ...Object.keys(input.files)])]

  for (const path of paths) {
    if (path.startsWith('adv/'))
      add({ path })
  }
  for (const path of ['adv.config.json', 'authoring/voices/library.json']) {
    if (input.files[path] !== undefined)
      add({ path })
  }
  for (const path of paths) {
    if (PROJECT_PACKAGE_VOICE_DESIGN_RE.test(path))
      add({ path })
  }
  const catalog = await projectPackageCatalogEntries(input.files)
  for (const path of catalog.consents)
    add({ path })
  for (const entry of catalog.media)
    add(entry)

  const advText = Object.keys(input.files).filter(path => path.startsWith('adv/'))
  return {
    manifest: createProjectPackageManifest(input.name, input.exportedAt, advText),
    entries: [...entries.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
  }
}
