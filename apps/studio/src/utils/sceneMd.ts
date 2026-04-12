import type { AdvBaseScene } from '@advjs/types'
import yaml from 'js-yaml'
import { dumpYamlFrontmatter, parseFrontmatterAndBody } from './mdFrontmatter'

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
  'src',
  'linkedLocation',
]

/**
 * Extended scene data for Studio editing
 */
export interface SceneFormData extends AdvBaseScene {
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

  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Scene .md must have a string `id` in frontmatter')

  const scene: SceneFormData = {
    id: fm.id,
    name: fm.name || fm.id,
    description: fm.description || body.trim() || undefined,
    imagePrompt: fm.imagePrompt,
    type: fm.type || 'image',
    alias: fm.alias,
    src: fm.src,
    tags: fm.tags,
    linkedLocation: fm.linkedLocation,
  }

  return Object.fromEntries(
    Object.entries(scene).filter(([_, v]) => v !== undefined),
  ) as SceneFormData
}

/**
 * SceneFormData → .md string
 */
export function stringifySceneMd(scene: SceneFormData): string {
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

  const yamlStr = dumpYamlFrontmatter(fm)

  return `---\n${yamlStr}\n---\n`
}
