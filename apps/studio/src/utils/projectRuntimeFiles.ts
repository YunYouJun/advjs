import type { AdvGameConfig, JsonObject } from '@advjs/types'
import type { IFileSystem } from './fs'

const RUNTIME_CHAPTER_ROOTS = [
  'adv/chapters',
  'adv',
  'public/md/chapters',
  'public/md',
] as const

export type StudioGameSettings = Partial<Pick<
  AdvGameConfig,
  'title' | 'description' | 'variables' | 'requiredPlugins'
>>

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
  settings: StudioGameSettings,
): Partial<AdvGameConfig> {
  return {
    ...generated,
    ...settings,
  }
}
