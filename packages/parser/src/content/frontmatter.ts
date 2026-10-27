import * as yaml from 'js-yaml'

/**
 * Options shared by content serializers.
 */
export interface ContentStringifyOptions {
  /**
   * Current file content. When provided, frontmatter keys and body text the
   * serializer does not manage are kept, and a document whose managed fields
   * did not change is returned byte for byte.
   */
  source?: string
}

/**
 * Split a Markdown document into its YAML frontmatter text and trimmed body.
 *
 * The closing delimiter is the first `---` after the opening one, matching the
 * project compiler and the Studio loaders.
 */
export function parseFrontmatterAndBody(content: string): { frontmatter: string, body: string } {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---'))
    return { frontmatter: '', body: trimmed }

  const endIndex = trimmed.indexOf('---', 3)
  if (endIndex === -1)
    return { frontmatter: '', body: trimmed }

  const frontmatter = trimmed.slice(3, endIndex).trim()
  const body = trimmed.slice(endIndex + 3).trim()
  return { frontmatter, body }
}

/**
 * Dump a frontmatter object to a YAML string with consistent formatting.
 * Symmetric counterpart to {@link parseFrontmatterAndBody}.
 */
export function dumpYamlFrontmatter(fm: Record<string, unknown>): string {
  return yaml.dump(fm, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    forceQuotes: false,
  }).trim()
}

/** Parse frontmatter YAML into a plain object; non-object YAML yields `{}`. */
export function loadFrontmatterObject(frontmatter: string): Record<string, any> {
  if (!frontmatter)
    return {}
  const data = yaml.load(frontmatter)
  return data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, any>
    : {}
}

/**
 * A document split for in-place updates. `bodyRaw` is everything after the
 * closing delimiter, unmodified, so untouched bodies keep their bytes.
 */
export interface FrontmatterSource {
  data: Record<string, any>
  body: string
  bodyRaw: string
}

/** Split `source` for an in-place update, or `undefined` when it has no frontmatter. */
export function readFrontmatterSource(source: string): FrontmatterSource | undefined {
  const start = source.trimStart()
  if (!start.startsWith('---'))
    return undefined
  const endIndex = start.indexOf('---', 3)
  if (endIndex === -1)
    return undefined
  const bodyRaw = start.slice(endIndex + 3)
  return {
    data: loadFrontmatterObject(start.slice(3, endIndex).trim()),
    body: bodyRaw.trim(),
    bodyRaw,
  }
}

/** Render frontmatter followed by an already formatted raw body. */
export function writeFrontmatterSource(data: Record<string, unknown>, bodyRaw: string): string {
  return `---\n${dumpYamlFrontmatter(data)}\n---${bodyRaw.startsWith('\n') || !bodyRaw ? bodyRaw : `\n${bodyRaw}`}`
}

/** Replace a body while keeping one blank line after the frontmatter, like the serializers. */
export function formatBodyRaw(body: string): string {
  const text = body.trim()
  return text ? `\n\n${text}\n` : '\n'
}

/** Structural equality for YAML/JSON values; object key order is ignored. */
export function isSameContentValue(left: unknown, right: unknown): boolean {
  if (left === right)
    return true
  if (left instanceof Date && right instanceof Date)
    return left.getTime() === right.getTime()
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length)
      return false
    return left.every((item, index) => isSameContentValue(item, right[index]))
  }
  if (left && right && typeof left === 'object' && typeof right === 'object') {
    const leftKeys = Object.keys(left).filter(key => (left as Record<string, unknown>)[key] !== undefined)
    const rightKeys = Object.keys(right).filter(key => (right as Record<string, unknown>)[key] !== undefined)
    if (leftKeys.length !== rightKeys.length)
      return false
    return leftKeys.every(key => isSameContentValue(
      (left as Record<string, unknown>)[key],
      (right as Record<string, unknown>)[key],
    ))
  }
  return false
}

/**
 * Apply edits of managed frontmatter keys onto the source frontmatter.
 *
 * A key whose next value equals the value parsed from the source keeps its
 * original representation (including being absent). Changed keys are set in
 * place or appended in `keys` order; `toFrontmatter` returning `undefined`
 * removes the key. Keys outside `keys` are never touched.
 */
export function mergeManagedFrontmatter(
  original: Record<string, any>,
  baseline: Record<string, any>,
  next: Record<string, any>,
  keys: readonly string[],
  toFrontmatter: (key: string, value: unknown) => unknown = defaultFrontmatterValue,
): { data: Record<string, any>, changed: boolean } {
  const changes = new Map<string, unknown>()
  for (const key of keys) {
    if (!isSameContentValue(baseline[key], next[key]))
      changes.set(key, toFrontmatter(key, next[key]))
  }
  if (changes.size === 0)
    return { data: original, changed: false }

  const data: Record<string, any> = {}
  for (const [key, value] of Object.entries(original)) {
    if (!changes.has(key)) {
      data[key] = value
      continue
    }
    const changed = changes.get(key)
    if (changed !== undefined)
      data[key] = changed
  }
  for (const key of keys) {
    if (!Object.hasOwn(original, key) && changes.get(key) !== undefined)
      data[key] = changes.get(key)
  }
  return { data, changed: true }
}

/** Serializer default: drop empty strings, nullish values and empty arrays. */
export function defaultFrontmatterValue(_key: string, value: unknown): unknown {
  if (value === undefined || value === null || value === '')
    return undefined
  if (Array.isArray(value) && value.length === 0)
    return undefined
  return value
}

/** Drop keys whose value is `undefined`, matching the parsers' output shape. */
export function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as T
}
