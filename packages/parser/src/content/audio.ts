import type { AdvMusic } from '@advjs/types'
import type { ContentStringifyOptions } from './frontmatter'
import { updateFrontmatterDocument } from './document'
import { dumpYamlFrontmatter, loadFrontmatterObject, parseFrontmatterAndBody, withoutUndefined } from './frontmatter'

/**
 * Audio metadata frontmatter keys
 */
const AUDIO_FRONTMATTER_KEYS: (keyof AdvMusic)[] = [
  'name',
  'assetId',
  'description',
  'src',
  'duration',
  'tags',
  'linkedScenes',
  'linkedChapters',
]

/**
 * Editable audio metadata (`adv/audio/*.md`).
 */
export interface AudioFormData extends AdvMusic {
  /** File path within the project (e.g. adv/audio/bgm.mp3) */
  file?: string
}

/**
 * Parse audio .md content → AudioFormData
 */
export function parseAudioMd(content: string): AudioFormData {
  const { frontmatter, body } = parseFrontmatterAndBody(content)
  const fm = loadFrontmatterObject(frontmatter)

  if (!fm.name || typeof fm.name !== 'string')
    throw new Error('Audio .md must have a string `name` in frontmatter')

  return withoutUndefined<AudioFormData>({
    name: fm.name,
    assetId: fm.assetId,
    description: fm.description || body.trim() || undefined,
    src: fm.src,
    duration: fm.duration,
    tags: fm.tags,
    linkedScenes: fm.linkedScenes,
    linkedChapters: fm.linkedChapters,
  })
}

/**
 * AudioFormData → .md string
 *
 * With `options.source`, unknown frontmatter keys and the body are kept.
 */
export function stringifyAudioMd(audio: AudioFormData, options: ContentStringifyOptions = {}): string {
  if (options.source !== undefined) {
    const updated = updateFrontmatterDocument({
      keys: AUDIO_FRONTMATTER_KEYS,
      parse: parseAudioMd,
      bodyField: 'description',
    }, options.source, audio)
    if (updated !== undefined)
      return updated
  }

  const fm: Record<string, any> = {}
  for (const key of AUDIO_FRONTMATTER_KEYS) {
    const value = (audio as any)[key]
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length === 0)
        continue
      fm[key] = value
    }
  }

  return `---\n${dumpYamlFrontmatter(fm)}\n---\n`
}
