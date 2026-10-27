/**
 * Discovery and summary rules for the content an authoring host lists:
 * chapters, characters, scenes, locations and audio.
 *
 * Studio applies the per-file helpers while reading its file system; native
 * hosts pass a file snapshot to {@link indexProjectContent}. Both therefore
 * agree on which files belong to a project and how each is summarized.
 */

import type { AdvCharacter } from '@advjs/types'
import { normalizeAdvAssetManifest, readAdvAssetManifestSource } from '@advjs/assets'
import { parseAudioMd, parseCharacterMd, parseLocationMd, parseSceneMd } from '@advjs/parser'

/** Chapter roots searched in order for Markdown projects; the first with chapters wins. */
export const PROJECT_CHAPTER_ROOTS = [
  'adv/chapters',
  'adv',
  'public/md/chapters',
  'public/md',
] as const

export const PROJECT_AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.opus', '.m4a', '.webm', '.flac', '.aac'] as const

const FILE_EXT_RE = /\.[^.]+$/u
const CHAPTER_NAME_RE = /\.(?:adv\.md|chapter\.json)$/u

export type ProjectSourceFormat = 'flow' | 'adv-md'

export interface ProjectChapterEntry {
  file: string
  name: string
  preview: string
  content?: string
  format?: ProjectSourceFormat
}

export interface ProjectSceneEntry {
  file: string
  name: string
  id?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
  tags?: string[]
  assetId?: string
  src?: string
  linkedLocation?: string
}

export interface ProjectAudioEntry {
  /** Metadata file path (e.g. adv/audio/bgm.md), audio file path, or `adv/assets.json#id`. */
  file: string
  name: string
  description?: string
  assetId?: string
  /** Audio file path within the project */
  src?: string
  duration?: number
  tags?: string[]
  linkedScenes?: string[]
  linkedChapters?: string[]
}

export interface ProjectLocationEntry {
  file: string
  name: string
  id?: string
  type?: 'indoor' | 'outdoor' | 'virtual' | 'other'
  description?: string
  tags?: string[]
  linkedScenes?: string[]
  linkedCharacters?: string[]
  defaultImagePrompt?: string
}

export interface ProjectContentIssue {
  code: 'ADV_PROJECT_CONTENT_UNREADABLE' | 'ADV_PROJECT_CONTENT_INVALID'
  file: string
  message: string
}

export interface ProjectContentIndex {
  format: ProjectSourceFormat
  chapters: ProjectChapterEntry[]
  characters: AdvCharacter[]
  scenes: ProjectSceneEntry[]
  locations: ProjectLocationEntry[]
  audios: ProjectAudioEntry[]
  issues: ProjectContentIssue[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function basename(file: string): string {
  return file.split('/').pop() ?? file
}

/**
 * Source format declared by `adv.config.json` (absent config means Markdown).
 * Throws `ADV_STUDIO_INVALID_PROJECT_FORMAT` for an unusable config.
 */
export function readProjectSourceFormat(configText: string | undefined): ProjectSourceFormat {
  if (configText === undefined)
    return 'adv-md'
  const config: unknown = JSON.parse(configText)
  if (!isRecord(config) || (config.format !== undefined && config.format !== 'flow' && config.format !== 'adv-md'))
    throw new Error('ADV_STUDIO_INVALID_PROJECT_FORMAT')
  return config.format === 'flow' ? 'flow' : 'adv-md'
}

function under(path: string, root: string): boolean {
  return root ? path.startsWith(`${root}/`) : true
}

/**
 * Chapter files of a project, given every project-relative path. Flow projects
 * list `adv/chapters/**\/*.chapter.json` only, never a retained Markdown mirror.
 */
export function discoverProjectChapterFiles(paths: readonly string[], format: ProjectSourceFormat): string[] {
  if (format === 'flow')
    return [...new Set(paths.filter(path => under(path, 'adv/chapters') && path.endsWith('.chapter.json')))].sort()
  for (const root of PROJECT_CHAPTER_ROOTS) {
    const chapters = [...new Set(paths.filter(path => under(path, root) && path.endsWith('.adv.md')))].sort()
    if (chapters.length > 0)
      return chapters
  }
  return []
}

/** Display name of a chapter file. */
export function projectChapterName(file: string): string {
  return basename(file).replace(CHAPTER_NAME_RE, '') || file
}

/** First meaningful line of a chapter, for lists. */
export function projectChapterPreview(file: string, content: string): string {
  if (file.endsWith('.chapter.json')) {
    const chapter = JSON.parse(content)
    return chapter.nodes?.find((node: { text?: string, dialogue?: { text?: string } }) => node.text || node.dialogue?.text)?.dialogue?.text
      ?? chapter.nodes?.find((node: { text?: string }) => node.text)?.text
      ?? ''
  }
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('---') && !line.startsWith('#'))
  return lines[0]?.slice(0, 100) || ''
}

function fileStem(file: string): string {
  return basename(file).replace('.md', '') || file
}

/** Scene list entry; unparseable files keep a name-only entry. */
export function projectSceneEntry(file: string, content: string): ProjectSceneEntry {
  const parsed = parseSceneMd(content)
  return {
    file,
    name: parsed.name || fileStem(file),
    id: parsed.id,
    description: parsed.description,
    imagePrompt: parsed.imagePrompt,
    type: parsed.type,
    tags: parsed.tags,
    assetId: parsed.assetId,
    src: parsed.src,
    linkedLocation: parsed.linkedLocation,
  }
}

export function projectLocationEntry(file: string, content: string): ProjectLocationEntry {
  const parsed = parseLocationMd(content)
  return {
    file,
    name: parsed.name || fileStem(file),
    id: parsed.id,
    type: parsed.type,
    description: parsed.description,
    tags: parsed.tags,
    linkedScenes: parsed.linkedScenes,
    linkedCharacters: parsed.linkedCharacters,
    defaultImagePrompt: parsed.defaultImagePrompt,
  }
}

export function projectAudioEntry(file: string, content: string): ProjectAudioEntry {
  const parsed = parseAudioMd(content)
  return {
    file,
    name: parsed.name,
    description: parsed.description,
    assetId: parsed.assetId,
    src: parsed.src,
    duration: parsed.duration,
    tags: parsed.tags,
    linkedScenes: parsed.linkedScenes,
    linkedChapters: parsed.linkedChapters,
  }
}

/** Name-only entry for content files that could not be parsed. */
export function projectFallbackEntry(file: string): { file: string, name: string } {
  return { file, name: fileStem(file) }
}

/** Raw audio files without a metadata document. */
export function projectRawAudioEntries(audioFiles: readonly string[], described: readonly ProjectAudioEntry[]): ProjectAudioEntry[] {
  const entries: ProjectAudioEntry[] = []
  for (const file of audioFiles) {
    const baseName = basename(file).replace(FILE_EXT_RE, '') || ''
    if (![...described, ...entries].some(audio => audio.name === baseName || audio.src === basename(file)))
      entries.push({ file, name: baseName, src: file })
  }
  return entries
}

/** Audio listed by an asset manifest, which replaces document-based audio when present. */
export function projectCatalogAudioEntries(manifest: unknown): ProjectAudioEntry[] {
  return normalizeAdvAssetManifest(manifest, { allowEmpty: true }).assets.filter(asset => asset.type === 'audio').map(asset => ({
    file: `adv/assets.json#${asset.id}`,
    name: asset.title || asset.id,
    assetId: asset.id,
    duration: asset.duration,
    tags: asset.labels,
  }))
}

function isAudioFile(path: string): boolean {
  const lower = path.toLowerCase()
  return PROJECT_AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext))
}

function directChildren(paths: readonly string[], directory: string, accept: (path: string) => boolean): string[] {
  return paths
    .filter(path => path.startsWith(`${directory}/`) && !path.slice(directory.length + 1).includes('/') && accept(path))
    .sort()
}

export interface IndexProjectContentInput {
  /** Text files keyed by project-relative path. */
  files: Readonly<Record<string, string>>
  /** Every project-relative path including binary files; defaults to the keys of `files`. */
  paths?: readonly string[]
}

/**
 * Index the content of a project snapshot, following the same rules Studio
 * uses when it loads a project. Per-file problems are reported as issues and
 * never abort the index; only an unusable `adv.config.json` throws.
 */
export function indexProjectContent(input: IndexProjectContentInput): ProjectContentIndex {
  const { files } = input
  const paths = [...new Set([...(input.paths ?? []), ...Object.keys(files)])]
  const issues: ProjectContentIssue[] = []
  const format = readProjectSourceFormat(files['adv.config.json'])

  const chapters = discoverProjectChapterFiles(paths, format).map((file) => {
    const content = files[file]
    let preview = ''
    if (content === undefined) {
      issues.push({ code: 'ADV_PROJECT_CONTENT_UNREADABLE', file, message: `Failed to read chapter ${file}` })
    }
    else {
      try {
        preview = projectChapterPreview(file, content)
      }
      catch (error) {
        issues.push({ code: 'ADV_PROJECT_CONTENT_INVALID', file, message: `Failed to read chapter ${file}: ${errorMessage(error)}` })
      }
    }
    return {
      file,
      name: projectChapterName(file),
      preview,
      content: content ?? '',
      format: file.endsWith('.chapter.json') ? 'flow' as const : 'adv-md' as const,
    }
  })

  const characters: AdvCharacter[] = []
  for (const file of directChildren(paths, 'adv/characters', path => path.endsWith('.character.md'))) {
    try {
      characters.push(parseCharacterMd(files[file] ?? ''))
    }
    catch (error) {
      issues.push({ code: 'ADV_PROJECT_CONTENT_INVALID', file, message: `Failed to parse character ${file}: ${errorMessage(error)}` })
    }
  }

  const scenes = directChildren(paths, 'adv/scenes', path => path.endsWith('.md')).map((file) => {
    try {
      return projectSceneEntry(file, files[file] ?? '')
    }
    catch (error) {
      issues.push({ code: 'ADV_PROJECT_CONTENT_INVALID', file, message: `Failed to parse scene ${file}: ${errorMessage(error)}` })
      return projectFallbackEntry(file)
    }
  })

  const locations = directChildren(paths, 'adv/locations', path => path.endsWith('.md')).map((file) => {
    try {
      return projectLocationEntry(file, files[file] ?? '')
    }
    catch (error) {
      issues.push({ code: 'ADV_PROJECT_CONTENT_INVALID', file, message: `Failed to parse location ${file}: ${errorMessage(error)}` })
      return projectFallbackEntry(file)
    }
  })

  let audios: ProjectAudioEntry[] = directChildren(paths, 'adv/audio', path => path.endsWith('.md')).map((file) => {
    try {
      return projectAudioEntry(file, files[file] ?? '')
    }
    catch (error) {
      issues.push({ code: 'ADV_PROJECT_CONTENT_INVALID', file, message: `Failed to parse audio ${file}: ${errorMessage(error)}` })
      return projectFallbackEntry(file)
    }
  })
  audios.push(...projectRawAudioEntries(directChildren(paths, 'adv/audio', isAudioFile), audios))
  if (files['adv/assets.json'] !== undefined) {
    try {
      audios = projectCatalogAudioEntries(readAdvAssetManifestSource(files)?.manifest)
    }
    catch (error) {
      issues.push({ code: 'ADV_PROJECT_CONTENT_INVALID', file: 'adv/assets.json', message: errorMessage(error) })
      audios = []
    }
  }

  return { format, chapters, characters, scenes, locations, audios, issues }
}
