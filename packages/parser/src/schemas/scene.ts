import { z } from 'zod'

/**
 * Zod schema for `scenes/*.md` frontmatter.
 *
 * Mirrors `AdvScene` (packages/types/src/game/scene.ts). Like the character
 * schema, it is intentionally lenient: unknown keys are stripped rather than
 * rejected (projects may carry custom fields), but the **types** of known
 * fields and the `type` enum are enforced so typos like `type: img` or
 * `tags: "学校"` are caught.
 */
export const SceneFrontmatterSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  alias: z.string().optional(),
  description: z.string().optional(),
  imagePrompt: z.string().optional(),
  type: z.enum(['image', 'model']).optional(),
  src: z.string().optional(),
  assetId: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export type SceneFrontmatterParsed = z.infer<typeof SceneFrontmatterSchema>

/**
 * Format a ZodError into a single human-readable line list.
 */
export function formatSceneFrontmatterError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}
