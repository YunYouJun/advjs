import yaml from 'js-yaml'
import { formatSceneFrontmatterError, SceneFrontmatterSchema } from './schemas/scene'

export interface SceneValidationResult {
  success: boolean
  /** Human-readable schema error (set when `success` is false). */
  error?: string
}

/**
 * Extract and YAML-parse the frontmatter object from a `scenes/*.md` file.
 * Returns an empty object when there is no frontmatter.
 */
export function parseSceneFrontmatterData(content: string): Record<string, any> {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---'))
    return {}
  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1)
    return {}
  const frontmatter = trimmed.slice(3, endIndex)
  const data = yaml.load(frontmatter)
  return (data && typeof data === 'object') ? data as Record<string, any> : {}
}

/**
 * Validate a scene file's frontmatter against {@link SceneFrontmatterSchema}.
 *
 * Soft validation — never throws. Used by `adv check` to surface malformed
 * scene frontmatter (wrong `type` enum, non-string fields, missing id).
 */
export function validateSceneFrontmatter(content: string): SceneValidationResult {
  const fm = parseSceneFrontmatterData(content)
  const result = SceneFrontmatterSchema.safeParse(fm)
  if (result.success)
    return { success: true }
  return { success: false, error: formatSceneFrontmatterError(result.error) }
}
