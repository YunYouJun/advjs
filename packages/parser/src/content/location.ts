import type { ContentStringifyOptions } from './frontmatter'
import { updateFrontmatterDocument } from './document'
import { dumpYamlFrontmatter, loadFrontmatterObject, parseFrontmatterAndBody, withoutUndefined } from './frontmatter'

/**
 * Location frontmatter keys
 */
const LOCATION_FRONTMATTER_KEYS: string[] = [
  'id',
  'name',
  'type',
  'description',
  'tags',
  'linkedScenes',
  'linkedCharacters',
  'defaultImagePrompt',
]

export type LocationType = 'indoor' | 'outdoor' | 'virtual' | 'other'

/**
 * Editable location data (`adv/locations/*.md`).
 */
export interface LocationFormData {
  id: string
  name: string
  type?: LocationType
  description?: string
  tags?: string[]
  linkedScenes?: string[]
  linkedCharacters?: string[]
  /** Default image prompt inherited by scenes linked to this location */
  defaultImagePrompt?: string
}

/**
 * Parse location .md content → LocationFormData
 */
export function parseLocationMd(content: string): LocationFormData {
  const { frontmatter, body } = parseFrontmatterAndBody(content)
  const fm = loadFrontmatterObject(frontmatter)

  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Location .md must have a string `id` in frontmatter')

  return withoutUndefined<LocationFormData>({
    id: fm.id,
    name: fm.name || fm.id,
    type: fm.type,
    description: fm.description || body.trim() || undefined,
    tags: fm.tags,
    linkedScenes: fm.linkedScenes,
    linkedCharacters: fm.linkedCharacters,
    defaultImagePrompt: fm.defaultImagePrompt,
  })
}

/**
 * LocationFormData → .md string
 *
 * With `options.source`, unknown frontmatter keys and the body are kept.
 */
export function stringifyLocationMd(location: LocationFormData, options: ContentStringifyOptions = {}): string {
  if (options.source !== undefined) {
    const updated = updateFrontmatterDocument({
      keys: LOCATION_FRONTMATTER_KEYS,
      parse: parseLocationMd,
      bodyField: 'description',
    }, options.source, location)
    if (updated !== undefined)
      return updated
  }

  const fm: Record<string, any> = {}
  for (const key of LOCATION_FRONTMATTER_KEYS) {
    const value = (location as any)[key]
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length === 0)
        continue
      fm[key] = value
    }
  }

  return `---\n${dumpYamlFrontmatter(fm)}\n---\n`
}
