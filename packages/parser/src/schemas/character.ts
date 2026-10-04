/**
 * Runtime schema for `.character.md` frontmatter.
 *
 * The parser preserves legacy fields even when schema validation warns. Strict
 * validation applies to the structured `attributes` and `visual` subtrees. Callers should
 * use `safeParse` so malformed files surface a warning rather than throw.
 */
import type { AdvCharacterFrontmatter, AdvCharacterVisual } from '@advjs/types'
import { z } from 'zod'

const NonBlankString = z.string().refine(value => value.trim().length > 0, 'Must not be blank')

/** Authoring references use portable paths relative to the project root. */
export const CharacterVisualReferenceSchema = z.object({
  path: NonBlankString.refine(
    value => value === value.trim()
      && !/[\\:?#%]/u.test(value)
      && [...value].every(character => character.charCodeAt(0) >= 32)
      && value.split('/').every(segment => segment !== '' && segment !== '.' && segment !== '..'),
    'Use a project-relative path without URLs, dot segments or encoded separators',
  ),
  description: NonBlankString.optional(),
}).strict()

/** Optional visual identity; legacy cards need no migration. */
export const CharacterVisualSchema = z.object({
  version: NonBlankString,
  references: z.array(CharacterVisualReferenceSchema).optional(),
  fixedTraits: z.array(NonBlankString).optional(),
  allowedChanges: z.array(NonBlankString).optional(),
}).strict() satisfies z.ZodType<AdvCharacterVisual, any, any>

/**
 * Universal profile fields shared by every template.
 */
export const CharacterProfileSchema = z.object({
  age: z.union([z.number(), z.string()]).optional(),
  gender: z.string().optional(),
  occupation: z.string().optional(),
  personalityTags: z.array(z.string()).optional(),
  appearanceSummary: z.string().optional(),
}).strict()

/**
 * Galgame / romance template fields.
 */
export const CharacterGalgameAttrsSchema = z.object({
  birthday: z.string().optional(),
  bloodType: z.string().optional(),
  zodiac: z.string().optional(),
  height: z.string().optional(),
  likes: z.array(z.string()).optional(),
  dislikes: z.array(z.string()).optional(),
  affinityInitial: z.number().optional(),
}).strict()

/**
 * Six-dimensional RPG stats.
 */
export const CharacterRpgStatsSchema = z.object({
  str: z.number().optional(),
  dex: z.number().optional(),
  int: z.number().optional(),
  con: z.number().optional(),
  wis: z.number().optional(),
  cha: z.number().optional(),
}).strict()

/**
 * RPG / fantasy template fields.
 */
export const CharacterRpgAttrsSchema = z.object({
  race: z.string().optional(),
  class: z.string().optional(),
  level: z.number().optional(),
  stats: CharacterRpgStatsSchema.optional(),
  hpInitial: z.number().optional(),
  mpInitial: z.number().optional(),
  skills: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  alignment: z.string().optional(),
}).strict()

/**
 * Mystery / script-killer fields.
 */
export const CharacterMysteryAttrsSchema = z.object({
  publicIdentity: z.string().optional(),
  secret: z.string().optional(),
  motive: z.string().optional(),
  alibi: z.string().optional(),
  clues: z.array(z.string()).optional(),
  redHerrings: z.array(z.string()).optional(),
  suspicionInitial: z.number().optional(),
}).strict()

/**
 * One user-defined custom field.
 */
export const CharacterCustomFieldSchema = z.object({
  label: z.string(),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
}).strict()

/**
 * AI control for the attributes panel.
 */
export const CharacterAttributesAiSchema = z.object({
  promptInject: z.boolean().optional(),
  visibility: z.enum(['public', 'gm-only']).optional(),
  excludeFields: z.array(z.string()).optional(),
}).strict()

/**
 * Structured character attributes (nested under `attributes.*` in frontmatter).
 */
export const CharacterAttributesSchema = z.object({
  template: z.enum(['universal', 'galgame', 'rpg', 'mystery']).optional(),
  profile: CharacterProfileSchema.optional(),
  galgame: CharacterGalgameAttrsSchema.optional(),
  rpg: CharacterRpgAttrsSchema.optional(),
  mystery: CharacterMysteryAttrsSchema.optional(),
  custom: z.record(z.string(), CharacterCustomFieldSchema).optional(),
  ai: CharacterAttributesAiSchema.optional(),
}).strict()

/**
 * Single tachie (sprite) entry.
 */
const TachieSchema = z.object({
  description: z.string().optional(),
  src: z.string(),
  class: z.union([z.string(), z.array(z.string())]).optional(),
  style: z.record(z.string(), z.string()).optional(),
}).strict()

/**
 * Character relationship entry.
 */
const RelationshipSchema = z.object({
  targetId: z.string(),
  type: z.string(),
  description: z.string().optional(),
}).strict()

/**
 * Full `.character.md` frontmatter schema.
 *
 * Note: legacy / free-form fields stay permissive so older files keep working.
 * Strict validation is enforced on the `attributes` and `visual` subtrees.
 */
export const CharacterFrontmatterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  avatar: z.string().optional(),
  imagePrompt: z.string().optional(),
  visual: CharacterVisualSchema.optional(),
  actor: z.string().optional(),
  cv: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  faction: z.string().optional(),
  language: z.enum(['zh', 'en', 'ja']).optional(),
  tachies: z.record(z.string(), TachieSchema).optional(),
  relationships: z.array(RelationshipSchema).optional(),
  attributes: CharacterAttributesSchema.optional(),
}) satisfies z.ZodType<AdvCharacterFrontmatter, any, any>

export type CharacterFrontmatterParsed = z.infer<typeof CharacterFrontmatterSchema>

/**
 * Format a ZodError into a single human-readable line list.
 */
export function formatCharacterFrontmatterError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '<root>'
      return `  - ${path}: ${issue.message}`
    })
    .join('\n')
}
