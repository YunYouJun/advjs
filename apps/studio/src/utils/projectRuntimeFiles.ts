import type {
  AdvGameConfig,
  AdvGameGalleryConfig,
  AdvGameProgressionConfig,
  JsonObject,
} from '@advjs/types'
import type { IFileSystem } from './fs'

const RUNTIME_CHAPTER_ROOTS = [
  'adv/chapters',
  'adv',
  'public/md/chapters',
  'public/md',
] as const

export interface StudioGalleryItem {
  id: string
  /** Stable reference resolved through adv/assets.json. */
  assetId?: string
  /** Optional thumbnail variant name in the asset catalog. */
  thumbnailVariant?: string
  title?: string
  src?: string
  thumbnail?: string
  alt?: string
  chapterId?: string
}

export interface StudioGameGalleryConfig {
  id: string
  version?: number
  allowDownload?: boolean
  items: StudioGalleryItem[]
}

export type StudioGameSettings = Partial<Pick<
  AdvGameConfig,
  'title' | 'description' | 'variables' | 'progression' | 'requiredPlugins'
>> & { gallery?: StudioGameGalleryConfig }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function invalidSettings(message: string): Error {
  return new Error(`ADV_STUDIO_INVALID_GAME_SETTINGS: ${message}`)
}

export async function discoverRuntimeChapterFiles(fs: IFileSystem): Promise<string[]> {
  for (const root of RUNTIME_CHAPTER_ROOTS) {
    try {
      const files = await fs.collectAllFiles(root)
      const chapters = [...new Set(files
        .map(file => file.path)
        .filter(path => path.endsWith('.adv.md')))]
        .sort()
      if (chapters.length > 0)
        return chapters
    }
    catch {
      // Try the next supported project layout.
    }
  }
  return []
}

export async function loadStudioGameSettings(fs: IFileSystem): Promise<StudioGameSettings> {
  const path = 'adv/settings/game.json'
  if (!await fs.exists(path))
    return {}

  let value: unknown
  try {
    value = JSON.parse(await fs.readFile(path))
  }
  catch (cause) {
    throw invalidSettings(cause instanceof Error ? cause.message : String(cause))
  }
  if (!isRecord(value))
    throw invalidSettings('Root value must be an object')

  const settings: StudioGameSettings = {}
  if (value.title !== undefined) {
    if (typeof value.title !== 'string')
      throw invalidSettings('title must be a string')
    settings.title = value.title
  }
  if (value.description !== undefined) {
    if (typeof value.description !== 'string')
      throw invalidSettings('description must be a string')
    settings.description = value.description
  }
  if (value.variables !== undefined) {
    if (!isRecord(value.variables))
      throw invalidSettings('variables must be an object')
    settings.variables = structuredClone(value.variables) as JsonObject
  }
  if (value.progression !== undefined) {
    if (!isRecord(value.progression)
      || typeof value.progression.id !== 'string'
      || !Array.isArray(value.progression.keys)
      || value.progression.keys.some(key => typeof key !== 'string')
      || (value.progression.version !== undefined
        && (!Number.isInteger(value.progression.version) || Number(value.progression.version) < 1))) {
      throw invalidSettings('progression must declare id, string keys, and an optional positive version')
    }
    settings.progression = structuredClone(value.progression) as unknown as AdvGameProgressionConfig
  }
  if (value.gallery !== undefined) {
    const gallery = value.gallery
    if (!isRecord(gallery)
      || typeof gallery.id !== 'string'
      || !Array.isArray(gallery.items)
      || gallery.items.some(item => (
        !isRecord(item)
        || typeof item.id !== 'string'
        || (typeof item.assetId !== 'string'
          && (typeof item.title !== 'string' || typeof item.src !== 'string'))
        || (item.assetId !== undefined && typeof item.assetId !== 'string')
        || (item.title !== undefined && typeof item.title !== 'string')
        || (item.src !== undefined && typeof item.src !== 'string')
        || (item.thumbnail !== undefined && typeof item.thumbnail !== 'string')
        || (item.thumbnailVariant !== undefined && typeof item.thumbnailVariant !== 'string')
        || (item.alt !== undefined && typeof item.alt !== 'string')
        || (item.chapterId !== undefined && typeof item.chapterId !== 'string')
      ))
      || (gallery.version !== undefined
        && (!Number.isInteger(gallery.version) || Number(gallery.version) < 1))
      || (gallery.allowDownload !== undefined && typeof gallery.allowDownload !== 'boolean')) {
      throw invalidSettings('gallery must declare id and valid CG items')
    }
    settings.gallery = structuredClone(gallery) as unknown as StudioGameGalleryConfig
  }
  if (value.requiredPlugins !== undefined) {
    if (!isRecord(value.requiredPlugins)
      || Object.values(value.requiredPlugins).some(version => typeof version !== 'string')) {
      throw invalidSettings('requiredPlugins must map plugin names to versions')
    }
    settings.requiredPlugins = structuredClone(value.requiredPlugins) as Record<string, string>
  }

  return settings
}

export function applyStudioGameSettings(
  generated: Partial<AdvGameConfig>,
  settings: Omit<StudioGameSettings, 'gallery'> & { gallery?: AdvGameGalleryConfig },
): Partial<AdvGameConfig> {
  return {
    ...generated,
    ...settings,
  }
}
