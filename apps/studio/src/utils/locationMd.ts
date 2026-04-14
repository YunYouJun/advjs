import yaml from 'js-yaml'
import { dumpYamlFrontmatter, parseFrontmatterAndBody } from './mdFrontmatter'

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
 * Location data for Studio editing
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

  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Location .md must have a string `id` in frontmatter')

  const location: LocationFormData = {
    id: fm.id,
    name: fm.name || fm.id,
    type: fm.type,
    description: fm.description || body.trim() || undefined,
    tags: fm.tags,
    linkedScenes: fm.linkedScenes,
    linkedCharacters: fm.linkedCharacters,
    defaultImagePrompt: fm.defaultImagePrompt,
  }

  return Object.fromEntries(
    Object.entries(location).filter(([_, v]) => v !== undefined),
  ) as LocationFormData
}

/**
 * LocationFormData → .md string
 */
export function stringifyLocationMd(location: LocationFormData): string {
  const fm: Record<string, any> = {}
  for (const key of LOCATION_FRONTMATTER_KEYS) {
    const value = (location as any)[key]
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length === 0)
        continue
      fm[key] = value
    }
  }

  const yamlStr = dumpYamlFrontmatter(fm)
  return `---\n${yamlStr}\n---\n`
}
