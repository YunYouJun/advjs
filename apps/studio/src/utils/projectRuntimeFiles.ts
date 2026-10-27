import type { AuthoringGalleryItem, AuthoringGameGalleryConfig, AuthoringGameSettings } from '@advjs/core'
import type { IFileSystem } from './fs'
import {
  applyAuthoringGameSettings,
  AUTHORING_GAME_SETTINGS_PATH,
  parseAuthoringGameSettings,
  PROJECT_CHAPTER_ROOTS,
  readProjectSourceFormat,
} from '@advjs/core'

export type StudioGalleryItem = AuthoringGalleryItem
export type StudioGameGalleryConfig = AuthoringGameGalleryConfig
export type StudioGameSettings = AuthoringGameSettings

export async function discoverRuntimeChapterFiles(fs: IFileSystem): Promise<string[]> {
  if (await loadStudioSourceFormat(fs) === 'flow') {
    // An explicit native Flow project must never open a retained Markdown mirror.
    const files = await fs.collectAllFiles('adv/chapters')
    return [...new Set(files.map(file => file.path).filter(path => path.endsWith('.chapter.json')))].sort()
  }
  for (const root of PROJECT_CHAPTER_ROOTS) {
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

export async function loadStudioSourceFormat(fs: IFileSystem): Promise<'flow' | 'adv-md'> {
  return readProjectSourceFormat(await fs.exists('adv.config.json')
    ? await fs.readFile('adv.config.json')
    : undefined)
}

export async function loadStudioGameSettings(fs: IFileSystem): Promise<StudioGameSettings> {
  return parseAuthoringGameSettings(await fs.exists(AUTHORING_GAME_SETTINGS_PATH)
    ? await fs.readFile(AUTHORING_GAME_SETTINGS_PATH)
    : undefined)
}

export const applyStudioGameSettings = applyAuthoringGameSettings
