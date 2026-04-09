import type { AdvMusic } from '@advjs/types'
import yaml from 'js-yaml'
import { dumpYamlFrontmatter, parseFrontmatterAndBody } from './mdFrontmatter'

/**
 * Audio metadata frontmatter keys
 */
const AUDIO_FRONTMATTER_KEYS: (keyof AdvMusic)[] = [
  'name',
  'description',
  'src',
  'duration',
  'tags',
  'linkedScenes',
  'linkedChapters',
]

/**
 * Extended audio data for Studio editing
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

  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

  if (!fm.name || typeof fm.name !== 'string')
    throw new Error('Audio .md must have a string `name` in frontmatter')

  const audio: AudioFormData = {
    name: fm.name,
    description: fm.description || body.trim() || undefined,
    src: fm.src,
    duration: fm.duration,
    tags: fm.tags,
    linkedScenes: fm.linkedScenes,
    linkedChapters: fm.linkedChapters,
  }

  return Object.fromEntries(
    Object.entries(audio).filter(([_, v]) => v !== undefined),
  ) as AudioFormData
}

/**
 * AudioFormData → .md string
 */
export function stringifyAudioMd(audio: AudioFormData): string {
  const fm: Record<string, any> = {}
  for (const key of AUDIO_FRONTMATTER_KEYS) {
    const value = (audio as any)[key]
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length === 0)
        continue
      fm[key] = value
    }
  }

  const yamlStr = dumpYamlFrontmatter(fm)
  return `---\n${yamlStr}\n---\n`
}
