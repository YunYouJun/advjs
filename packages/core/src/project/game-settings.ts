/**
 * Authoring view of `adv/settings/game.json`: the fields Studio hosts read
 * to compile and preview a project, validated with stable error codes.
 */

import type {
  AdvGameConfig,
  AdvGameGalleryConfig,
  AdvGameProgressionConfig,
  JsonObject,
} from '@advjs/types'

export interface AuthoringGalleryItem {
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

export interface AuthoringGameGalleryConfig {
  id: string
  version?: number
  allowDownload?: boolean
  items: AuthoringGalleryItem[]
}

export type AuthoringGameSettings = Partial<Pick<
  AdvGameConfig,
  'title' | 'description' | 'variables' | 'progression' | 'requiredPlugins'
>> & { gallery?: AuthoringGameGalleryConfig }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function invalidSettings(message: string): Error {
  return new Error(`ADV_STUDIO_INVALID_GAME_SETTINGS: ${message}`)
}

/** Project path of the game settings file. */
export const AUTHORING_GAME_SETTINGS_PATH = 'adv/settings/game.json'

/**
 * Parse game settings text. A missing file yields `{}`; malformed settings
 * throw `ADV_STUDIO_INVALID_GAME_SETTINGS`.
 */
export function parseAuthoringGameSettings(text: string | undefined): AuthoringGameSettings {
  if (text === undefined)
    return {}

  let value: unknown
  try {
    value = JSON.parse(text)
  }
  catch (cause) {
    throw invalidSettings(cause instanceof Error ? cause.message : String(cause))
  }
  if (!isRecord(value))
    throw invalidSettings('Root value must be an object')

  const settings: AuthoringGameSettings = {}
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
    settings.gallery = structuredClone(gallery) as unknown as AuthoringGameGalleryConfig
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

export function applyAuthoringGameSettings(
  generated: Partial<AdvGameConfig>,
  settings: Omit<AuthoringGameSettings, 'gallery'> & { gallery?: AdvGameGalleryConfig },
): Partial<AdvGameConfig> {
  return {
    ...generated,
    ...settings,
  }
}
