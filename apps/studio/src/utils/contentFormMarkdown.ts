import type { AudioFormData, ChapterFormData, LocationFormData, SceneFormData } from '@advjs/parser'
import type { AdvCharacter } from '@advjs/types'
import {
  parseChapterMd,
  parseCharacterMd,
  parseLocationMd,
  parseSceneMd,
  stringifyCharacterMd,
  stringifyLocationMd,
  stringifySceneMd,
  updateChapterMd,
} from '@advjs/parser'

export type ContentType = 'character' | 'scene' | 'chapter' | 'audio' | 'location'
export type ContentFormData = AdvCharacter | SceneFormData | ChapterFormData | AudioFormData | LocationFormData

/** Dispatch to the shared project format; raw drafts and saved baselines stay distinct. */
export function parseContentFormMarkdown(type: ContentType, markdown: string, filename: string): ContentFormData {
  switch (type) {
    case 'character': return parseCharacterMd(markdown)
    case 'scene': return parseSceneMd(markdown)
    case 'location': return parseLocationMd(markdown)
    case 'chapter': return parseChapterMd(markdown, filename)
    default: throw new Error('ADV_STUDIO_CONTENT_TYPE_INVALID')
  }
}

export function stringifyContentFormMarkdown(type: ContentType, data: ContentFormData, source?: string): string {
  switch (type) {
    case 'character': return stringifyCharacterMd(data as AdvCharacter, { source })
    case 'scene': return stringifySceneMd(data as SceneFormData, { source })
    case 'location': return stringifyLocationMd(data as LocationFormData, { source })
    case 'chapter': return updateChapterMd(data as ChapterFormData)
    default: throw new Error('ADV_STUDIO_CONTENT_TYPE_INVALID')
  }
}
