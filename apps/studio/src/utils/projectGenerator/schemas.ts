/**
 * Lightweight hand-rolled validators for each LLM generation step.
 *
 * These power `runAiJsonExtraction<T>(prompt, validate, retries)` from
 * `utils/aiExtraction.ts` — if `validate` throws, the extraction returns
 * `null` and the generator retries up to N times, then marks the step as
 * failed and continues with `draftMode`.
 *
 * Rules:
 *   - Throw a descriptive `Error` on any malformed shape.
 *   - Coerce obvious misses (e.g. trimming strings) silently.
 *   - Never return partial data — validators are all-or-nothing per step.
 *   - No external deps (no zod): keeps the runtime bundle small and matches
 *     the existing extraction pattern.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond)
    throw new Error(msg)
}

function asString(v: unknown, path: string): string {
  assert(typeof v === 'string', `${path} must be a string`)
  const trimmed = (v as string).trim()
  assert(trimmed.length > 0, `${path} must be a non-empty string`)
  return trimmed
}

function asOptionalString(v: unknown, path: string): string | undefined {
  if (v === undefined || v === null || v === '')
    return undefined
  assert(typeof v === 'string', `${path} must be a string if present`)
  return (v as string).trim() || undefined
}

function asOptionalStringArray(v: unknown, path: string): string[] | undefined {
  if (v === undefined || v === null)
    return undefined
  assert(Array.isArray(v), `${path} must be an array if present`)
  const arr = (v as unknown[]).map((x, i) => asString(x, `${path}[${i}]`))
  return arr.length > 0 ? arr : undefined
}

function asArray<T>(v: unknown, path: string, min: number, itemValidator: (x: unknown, itemPath: string) => T): T[] {
  assert(Array.isArray(v), `${path} must be an array`)
  const arr = v as unknown[]
  assert(arr.length >= min, `${path} must contain at least ${min} items, got ${arr.length}`)
  return arr.map((item, i) => itemValidator(item, `${path}[${i}]`))
}

// ---------------------------------------------------------------------------
// Step 1 — characters
// ---------------------------------------------------------------------------

export interface GeneratedCharacter {
  id: string
  name: string
  tags?: string[]
  voiceHint?: string
  appearance?: string
  personality?: string
  background?: string
  concept?: string
  speechStyle?: string
}

export interface CharactersJson {
  characters: GeneratedCharacter[]
}

function validateCharacter(raw: unknown, path: string): GeneratedCharacter {
  assert(raw && typeof raw === 'object', `${path} must be an object`)
  const obj = raw as Record<string, unknown>
  return {
    id: asString(obj.id, `${path}.id`),
    name: asString(obj.name, `${path}.name`),
    tags: asOptionalStringArray(obj.tags, `${path}.tags`),
    voiceHint: asOptionalString(obj.voiceHint, `${path}.voiceHint`),
    appearance: asOptionalString(obj.appearance, `${path}.appearance`),
    personality: asOptionalString(obj.personality, `${path}.personality`),
    background: asOptionalString(obj.background, `${path}.background`),
    concept: asOptionalString(obj.concept, `${path}.concept`),
    speechStyle: asOptionalString(obj.speechStyle, `${path}.speechStyle`),
  }
}

export function validateCharactersJson(raw: unknown): CharactersJson {
  assert(raw && typeof raw === 'object', 'characters response must be an object')
  const obj = raw as Record<string, unknown>
  const characters = asArray(obj.characters, 'characters', 1, validateCharacter)
  // ensure ids are unique
  const ids = new Set<string>()
  for (const c of characters) {
    if (ids.has(c.id))
      throw new Error(`duplicate character id "${c.id}"`)
    ids.add(c.id)
  }
  return { characters }
}

// ---------------------------------------------------------------------------
// Step 2 — chapters
// ---------------------------------------------------------------------------

export interface ChapterChoice {
  label: string
  hint?: string
}

export interface GeneratedChapter {
  filename: string
  title: string
  phase: string
  plotSummary?: string
  body: string
  choices?: ChapterChoice[]
  /** Scene keys referenced in this chapter (to be expanded in step 3). */
  sceneRefs?: string[]
}

export interface ChapterJson {
  chapter: GeneratedChapter
}

function validateChoice(raw: unknown, path: string): ChapterChoice {
  assert(raw && typeof raw === 'object', `${path} must be an object`)
  const obj = raw as Record<string, unknown>
  return {
    label: asString(obj.label, `${path}.label`),
    hint: asOptionalString(obj.hint, `${path}.hint`),
  }
}

export function validateChapterJson(raw: unknown): ChapterJson {
  assert(raw && typeof raw === 'object', 'chapter response must be an object')
  const obj = raw as Record<string, unknown>
  const chapter = obj.chapter as Record<string, unknown> | undefined
  assert(chapter && typeof chapter === 'object', 'chapter response must contain a `chapter` object')

  return {
    chapter: {
      filename: asString(chapter.filename, 'chapter.filename'),
      title: asString(chapter.title, 'chapter.title'),
      phase: asString(chapter.phase, 'chapter.phase'),
      plotSummary: asOptionalString(chapter.plotSummary, 'chapter.plotSummary'),
      body: asString(chapter.body, 'chapter.body'),
      choices: chapter.choices === undefined
        ? undefined
        : asArray(chapter.choices, 'chapter.choices', 0, validateChoice),
      sceneRefs: asOptionalStringArray(chapter.sceneRefs, 'chapter.sceneRefs'),
    },
  }
}

// ---------------------------------------------------------------------------
// Step 3 — scenes (+ locations by-product)
// ---------------------------------------------------------------------------

export interface GeneratedScene {
  id: string
  name: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
  tags?: string[]
  linkedLocation?: string
}

export interface GeneratedLocation {
  id: string
  name: string
  type?: 'indoor' | 'outdoor' | 'virtual' | 'other'
  description?: string
  tags?: string[]
  defaultImagePrompt?: string
}

export interface ScenesJson {
  scenes: GeneratedScene[]
  locations?: GeneratedLocation[]
}

function validateScene(raw: unknown, path: string): GeneratedScene {
  assert(raw && typeof raw === 'object', `${path} must be an object`)
  const obj = raw as Record<string, unknown>
  const type = obj.type === undefined ? undefined : asString(obj.type, `${path}.type`)
  if (type !== undefined && type !== 'image' && type !== 'model')
    throw new Error(`${path}.type must be "image" or "model" if present`)
  return {
    id: asString(obj.id, `${path}.id`),
    name: asString(obj.name, `${path}.name`),
    description: asOptionalString(obj.description, `${path}.description`),
    imagePrompt: asOptionalString(obj.imagePrompt, `${path}.imagePrompt`),
    type: type as GeneratedScene['type'],
    tags: asOptionalStringArray(obj.tags, `${path}.tags`),
    linkedLocation: asOptionalString(obj.linkedLocation, `${path}.linkedLocation`),
  }
}

const LOCATION_TYPES = new Set(['indoor', 'outdoor', 'virtual', 'other'])

function validateLocation(raw: unknown, path: string): GeneratedLocation {
  assert(raw && typeof raw === 'object', `${path} must be an object`)
  const obj = raw as Record<string, unknown>
  const type = obj.type === undefined ? undefined : asString(obj.type, `${path}.type`)
  if (type !== undefined && !LOCATION_TYPES.has(type))
    throw new Error(`${path}.type must be one of ${[...LOCATION_TYPES].join(', ')}`)
  return {
    id: asString(obj.id, `${path}.id`),
    name: asString(obj.name, `${path}.name`),
    type: type as GeneratedLocation['type'],
    description: asOptionalString(obj.description, `${path}.description`),
    tags: asOptionalStringArray(obj.tags, `${path}.tags`),
    defaultImagePrompt: asOptionalString(obj.defaultImagePrompt, `${path}.defaultImagePrompt`),
  }
}

export function validateScenesJson(raw: unknown): ScenesJson {
  assert(raw && typeof raw === 'object', 'scenes response must be an object')
  const obj = raw as Record<string, unknown>
  const scenes = asArray(obj.scenes, 'scenes', 1, validateScene)
  const locations = obj.locations === undefined
    ? undefined
    : asArray(obj.locations, 'locations', 0, validateLocation)
  return { scenes, locations }
}

// ---------------------------------------------------------------------------
// Step 4 — knowledge
// ---------------------------------------------------------------------------

export interface GeneratedKnowledgeEntry {
  id: string
  title: string
  domain?: string
  body: string
  tags?: string[]
}

export interface KnowledgeJson {
  entries: GeneratedKnowledgeEntry[]
}

function validateKnowledgeEntry(raw: unknown, path: string): GeneratedKnowledgeEntry {
  assert(raw && typeof raw === 'object', `${path} must be an object`)
  const obj = raw as Record<string, unknown>
  return {
    id: asString(obj.id, `${path}.id`),
    title: asString(obj.title, `${path}.title`),
    domain: asOptionalString(obj.domain, `${path}.domain`),
    body: asString(obj.body, `${path}.body`),
    tags: asOptionalStringArray(obj.tags, `${path}.tags`),
  }
}

export function validateKnowledgeJson(raw: unknown): KnowledgeJson {
  assert(raw && typeof raw === 'object', 'knowledge response must be an object')
  const obj = raw as Record<string, unknown>
  const entries = asArray(obj.entries, 'entries', 0, validateKnowledgeEntry)
  // dedupe by id
  const ids = new Set<string>()
  for (const e of entries) {
    if (ids.has(e.id))
      throw new Error(`duplicate knowledge id "${e.id}"`)
    ids.add(e.id)
  }
  return { entries }
}
