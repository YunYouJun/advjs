import type { AdvBaseScene } from '@advjs/types'
import type { ContentStringifyOptions } from './frontmatter'
import { updateFrontmatterDocument } from './document'
import { dumpYamlFrontmatter, loadFrontmatterObject, parseFrontmatterAndBody, withoutUndefined } from './frontmatter'

/**
 * Scene frontmatter fields (includes `src` from AdvSceneImage)
 */
const SCENE_FRONTMATTER_KEYS: string[] = [
  'id',
  'name',
  'description',
  'imagePrompt',
  'type',
  'alias',
  'assetId',
  'src',
  'linkedLocation',
]

/**
 * Editable scene data (`adv/scenes/*.md`).
 */
export interface SceneFormData extends AdvBaseScene {
  /** Stable ID in adv/assets.json. */
  assetId?: string
  /** Image source path or URL (from AdvSceneImage) */
  src?: string
  tags?: string[]
  /** Linked location ID from adv/locations/ */
  linkedLocation?: string
}

/**
 * Parse scene .md content → SceneFormData
 */
export function parseSceneMd(content: string): SceneFormData {
  const { frontmatter, body } = parseFrontmatterAndBody(content)
  const fm = loadFrontmatterObject(frontmatter)

  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Scene .md must have a string `id` in frontmatter')

  return withoutUndefined<SceneFormData>({
    id: fm.id,
    name: fm.name || fm.id,
    description: fm.description || body.trim() || undefined,
    imagePrompt: fm.imagePrompt,
    type: fm.type || 'image',
    alias: fm.alias,
    assetId: fm.assetId,
    src: fm.src,
    tags: fm.tags,
    linkedLocation: fm.linkedLocation,
  })
}

/**
 * SceneFormData → .md string
 *
 * With `options.source`, unknown frontmatter keys and the body are kept.
 */
export function stringifySceneMd(scene: SceneFormData, options: ContentStringifyOptions = {}): string {
  if (options.source !== undefined) {
    const updated = updateFrontmatterDocument({
      keys: [...SCENE_FRONTMATTER_KEYS, 'tags'],
      parse: parseSceneMd,
      bodyField: 'description',
    }, options.source, scene)
    if (updated !== undefined)
      return updated
  }

  const fm: Record<string, any> = {}
  for (const key of SCENE_FRONTMATTER_KEYS) {
    const value = (scene as any)[key]
    if (value !== undefined && value !== null && value !== '') {
      fm[key] = value
    }
  }
  // Include tags in frontmatter
  if (scene.tags && scene.tags.length > 0) {
    fm.tags = scene.tags
  }

  return `---\n${dumpYamlFrontmatter(fm)}\n---\n`
}
