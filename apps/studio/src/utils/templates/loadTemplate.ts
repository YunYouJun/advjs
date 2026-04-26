/**
 * Template YAML loader for Phase M10 Source-to-Project pipeline.
 *
 * Templates live under `apps/studio/src/templates/*.yaml` and are loaded
 * eagerly via Vite's `import.meta.glob` with `?raw` so the parsed registry
 * is available synchronously from any consumer. Malformed YAML or missing
 * required fields fail fast at module-load time — we'd rather crash at
 * `pnpm dev` than silently during a contest demo.
 */

import type { SourceType } from '../sourceParser'
import yaml from 'js-yaml'

export interface CharacterArchetype {
  role: string
  voiceHint: string
  tone: string
}

export interface ChapterPhaseSpec {
  phase: string
  choices: number
  targetTokens: number
}

export interface TemplateDef {
  id: string
  name: string
  description: string
  version: number
  recommendedSources: SourceType[]
  systemPrompt: string
  characterArchetypes: CharacterArchetype[]
  chapterStructure: ChapterPhaseSpec[]
  sceneStyle: string
  ttsEnabled: boolean
  knowledgeExtraction: boolean
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: Array<keyof TemplateDef> = [
  'id',
  'name',
  'description',
  'version',
  'recommendedSources',
  'systemPrompt',
  'characterArchetypes',
  'chapterStructure',
  'sceneStyle',
  'ttsEnabled',
  'knowledgeExtraction',
]

const ALLOWED_SOURCE_TYPES = new Set<SourceType>(['text', 'markdown', 'chat-log', 'pdf', 'url', 'image', 'audio'])

// Vite glob: eager + raw. Returns { [path]: string } where string is the raw YAML.
// The `query: '?raw'` + `import: 'default'` form is the recommended API; it
// ships the file content as a plain string at build time.
const yamlModules = import.meta.glob('../../templates/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function parseTemplate(path: string, raw: string): TemplateDef {
  let parsed: unknown
  try {
    parsed = yaml.load(raw)
  }
  catch (err) {
    throw new Error(`[templates] failed to parse YAML at ${path}: ${(err as Error).message}`)
  }
  if (!parsed || typeof parsed !== 'object')
    throw new Error(`[templates] expected object at ${path}, got ${typeof parsed}`)

  const obj = parsed as Record<string, unknown>

  for (const field of REQUIRED_FIELDS) {
    if (obj[field] === undefined)
      throw new Error(`[templates] missing field "${field}" in ${path}`)
  }

  // Validate recommendedSources
  if (!Array.isArray(obj.recommendedSources))
    throw new Error(`[templates] recommendedSources must be an array in ${path}`)
  for (const src of obj.recommendedSources as unknown[]) {
    if (typeof src !== 'string' || !ALLOWED_SOURCE_TYPES.has(src as SourceType))
      throw new Error(`[templates] invalid recommendedSources value "${String(src)}" in ${path}`)
  }

  if (!Array.isArray(obj.characterArchetypes))
    throw new Error(`[templates] characterArchetypes must be an array in ${path}`)
  if (!Array.isArray(obj.chapterStructure))
    throw new Error(`[templates] chapterStructure must be an array in ${path}`)

  return obj as unknown as TemplateDef
}

function loadRegistry(): Record<string, TemplateDef> {
  const registry: Record<string, TemplateDef> = {}
  for (const [path, raw] of Object.entries(yamlModules)) {
    const tpl = parseTemplate(path, raw)
    if (registry[tpl.id])
      throw new Error(`[templates] duplicate template id "${tpl.id}" (second occurrence: ${path})`)
    registry[tpl.id] = tpl
  }
  return registry
}

// Eager registry — built at module load, cached for the lifetime of the module.
// Tests reset via `__resetTemplateRegistryForTests`.
let registry = loadRegistry()

/**
 * For unit tests only. Re-parses the YAML glob. Callers in production code
 * should never use this.
 */
export function __resetTemplateRegistryForTests(): void {
  registry = loadRegistry()
}

/**
 * Look up a template by id. Returns `undefined` if not found.
 */
export function getTemplate(id: string): TemplateDef | undefined {
  return registry[id]
}

/**
 * List all loaded templates, sorted by name.
 */
export function listTemplates(): TemplateDef[] {
  return Object.values(registry).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
}

/**
 * Pick the best template for a normalized source.
 *
 * Precedence:
 *   1. If the source carries `suggestedTemplateId` from the parser, use it.
 *   2. Otherwise fall back to the first template that `recommendedSources`
 *      includes the source type.
 *   3. Last resort: the first template in the registry.
 */
export function suggestTemplateFor(
  source: { type: SourceType, suggestedTemplateId?: string },
): TemplateDef | undefined {
  if (source.suggestedTemplateId) {
    const hit = registry[source.suggestedTemplateId]
    if (hit)
      return hit
  }
  const bySource = listTemplates().find(tpl => tpl.recommendedSources.includes(source.type))
  if (bySource)
    return bySource
  return listTemplates()[0]
}
