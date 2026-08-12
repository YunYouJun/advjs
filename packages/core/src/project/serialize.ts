import type { AdvProjectFileMap, JsonValue } from '@advjs/types'

const ADV_CONFIG_FIELDS = new Set(['entryChapterId', 'format', 'id', 'plugins', 'root', 'runtimePlugins', 'theme'])
const GAME_CONFIG_FIELDS = new Set([
  'assets',
  'bgm',
  'chapters',
  'characters',
  'cover',
  'description',
  'entryChapterId',
  'favicon',
  'gallery',
  'id',
  'progression',
  'requiredPlugins',
  'scenes',
  'title',
  'variables',
])
const CHARACTER_FIELDS = new Set([
  'actor',
  'aliases',
  'attributes',
  'avatar',
  'cv',
  'faction',
  'id',
  'imagePrompt',
  'language',
  'name',
  'relationships',
  'tachies',
  'tags',
])
const SCENE_FIELDS = new Set(['alias', 'assetId', 'description', 'id', 'imagePrompt', 'name', 'src', 'tags', 'type'])

export type ProjectSourcePatch
  = | { kind: 'json-set', path: string, key: string, value: JsonValue }
    | { kind: 'frontmatter-set', path: string, key: string, value: JsonValue | undefined }
    | { kind: 'raw-text', path: string, content: string }

export interface ApplyProjectPatchesResult {
  changedPaths: string[]
  files: AdvProjectFileMap
}

function assertProjectPath(path: string) {
  if (!path || path.startsWith('/') || path.split(/[\\/]/u).includes('..'))
    throw new Error(`Invalid project patch path: ${path}`)
}

function allowedJsonFields(path: string) {
  if (path === 'adv.config.json')
    return ADV_CONFIG_FIELDS
  if (path === 'game.config.json' || /(?:^|\/)settings\/game\.json$/u.test(path))
    return GAME_CONFIG_FIELDS
  return undefined
}

function allowedFrontmatterFields(path: string) {
  if (path.endsWith('.character.md'))
    return CHARACTER_FIELDS
  if (/(?:^|\/)scenes\/[^/]+\.md$/u.test(path))
    return SCENE_FIELDS
  return undefined
}

function skipWhitespace(text: string, start: number) {
  let index = start
  while (/\s/u.test(text[index] ?? ''))
    index += 1
  return index
}

function readJsonString(text: string, start: number) {
  if (text[start] !== '"')
    throw new Error(`Expected JSON string at offset ${start}`)
  let escaped = false
  for (let index = start + 1; index < text.length; index += 1) {
    if (escaped) {
      escaped = false
      continue
    }
    if (text[index] === '\\') {
      escaped = true
      continue
    }
    if (text[index] === '"')
      return index + 1
  }
  throw new Error('Unterminated JSON string')
}

function readJsonValue(text: string, start: number) {
  if (text[start] === '"')
    return readJsonString(text, start)
  if (text[start] === '{' || text[start] === '[') {
    const opening = text[start]
    const closing = opening === '{' ? '}' : ']'
    let depth = 0
    for (let index = start; index < text.length; index += 1) {
      if (text[index] === '"') {
        index = readJsonString(text, index) - 1
        continue
      }
      if (text[index] === opening)
        depth += 1
      else if (text[index] === closing && --depth === 0)
        return index + 1
    }
    throw new Error('Unterminated JSON container')
  }
  let index = start
  while (index < text.length && text[index] !== ',' && text[index] !== '}')
    index += 1
  return index
}

function findTopLevelJsonProperty(text: string, target: string) {
  let index = skipWhitespace(text, 0)
  if (text[index] !== '{')
    throw new Error('Structured JSON patches require an object root')
  index += 1

  while (index < text.length) {
    index = skipWhitespace(text, index)
    if (text[index] === '}')
      return { closingBrace: index }
    const keyStart = index
    const keyEnd = readJsonString(text, keyStart)
    const key = JSON.parse(text.slice(keyStart, keyEnd)) as string
    index = skipWhitespace(text, keyEnd)
    if (text[index] !== ':')
      throw new Error(`Expected JSON colon after ${key}`)
    const valueStart = skipWhitespace(text, index + 1)
    const valueEnd = readJsonValue(text, valueStart)
    if (key === target)
      return { closingBrace: -1, valueEnd, valueStart }
    index = skipWhitespace(text, valueEnd)
    if (text[index] === ',')
      index += 1
  }
  throw new Error('Unterminated JSON object')
}

function patchJson(text: string, key: string, value: JsonValue) {
  JSON.parse(text)
  const serialized = JSON.stringify(value)
  const property = findTopLevelJsonProperty(text, key)
  let patched: string
  if (property.valueStart !== undefined && property.valueEnd !== undefined) {
    patched = `${text.slice(0, property.valueStart)}${serialized}${text.slice(property.valueEnd)}`
  }
  else {
    const closingBrace = property.closingBrace
    let contentEnd = closingBrace
    while (contentEnd > 0 && /\s/u.test(text[contentEnd - 1]))
      contentEnd -= 1
    const empty = text.slice(0, contentEnd).trimEnd().endsWith('{')
    const indent = text.match(/\n([ \t]+)"/u)?.[1] ?? '  '
    const insertion = `${empty ? '' : ','}\n${indent}${JSON.stringify(key)}: ${serialized}`
    patched = `${text.slice(0, contentEnd)}${insertion}${text.slice(contentEnd)}`
  }
  JSON.parse(patched)
  return patched
}

function patchFrontmatter(text: string, key: string, value: JsonValue | undefined) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/u)
  if (lines[0] !== '---')
    throw new Error('Structured frontmatter patches require a leading --- block')
  const end = lines.indexOf('---', 1)
  if (end === -1)
    throw new Error('Unterminated Markdown frontmatter')

  const start = lines.findIndex((line, index) => index > 0 && index < end && line.startsWith(`${key}:`))
  let fieldEnd = start + 1
  if (start >= 0) {
    while (fieldEnd < end && (lines[fieldEnd].startsWith(' ') || lines[fieldEnd].startsWith('\t')))
      fieldEnd += 1
    lines.splice(start, fieldEnd - start, ...(value === undefined ? [] : [`${key}: ${JSON.stringify(value)}`]))
  }
  else if (value !== undefined) {
    lines.splice(end, 0, `${key}: ${JSON.stringify(value)}`)
  }
  return lines.join(newline)
}

export function applyProjectPatches(
  sourceFiles: Readonly<AdvProjectFileMap>,
  patches: readonly ProjectSourcePatch[],
): ApplyProjectPatchesResult {
  const files = { ...sourceFiles }
  const changed = new Set<string>()

  for (const patch of patches) {
    assertProjectPath(patch.path)
    const source = files[patch.path]
    if (source === undefined)
      throw new Error(`Project patch target does not exist: ${patch.path}`)

    let next: string
    if (patch.kind === 'json-set') {
      const fields = allowedJsonFields(patch.path)
      if (!fields?.has(patch.key))
        throw new Error(`A structured patch is not allowed for ${patch.path}#${patch.key}`)
      next = patchJson(source, patch.key, patch.value)
    }
    else if (patch.kind === 'frontmatter-set') {
      const fields = allowedFrontmatterFields(patch.path)
      if (!fields?.has(patch.key))
        throw new Error(`A structured patch is not allowed for ${patch.path}#${patch.key}`)
      next = patchFrontmatter(source, patch.key, patch.value)
    }
    else {
      if (!patch.path.endsWith('.md'))
        throw new Error(`raw-text patches are restricted to Markdown files: ${patch.path}`)
      next = patch.content
    }

    if (next !== source) {
      files[patch.path] = next
      changed.add(patch.path)
    }
  }

  return {
    changedPaths: [...changed].sort(),
    files: Object.fromEntries(Object.entries(files).sort(([left], [right]) => left.localeCompare(right, 'en'))),
  }
}
