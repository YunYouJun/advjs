/**
 * Script reference extraction utilities.
 *
 * Extract character and scene references from .adv.md script content.
 * Shared by CLI `adv check` (Node) and Studio `projectValidation` (Browser).
 *
 * @module @advjs/parser
 */

// Match @Name(status) or @Name（状态）— trailing parentheses to strip
const PARENTHESES_STATUS_RE = /[（(].*?[）)]$/

// Match 【place，time，inOrOut】 scene blocks
const SCENE_BLOCK_RE = /^【(.+)】$/gm

/**
 * Extract character names referenced via `@Name` syntax from `.adv.md` content.
 *
 * Handles `@Name`, `@Name(status)`, and `@Name（状态）` patterns.
 */
export function extractCharacterRefs(content: string): string[] {
  const names = new Set<string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('@'))
      continue
    let name = trimmed.slice(1) // remove @
    name = name.replace(PARENTHESES_STATUS_RE, '').trim()
    if (name)
      names.add(name)
  }
  return [...names]
}

/**
 * Extract scene place names from `【place，time，inOrOut】` syntax in `.adv.md` content.
 */
export function extractSceneRefs(content: string): string[] {
  const places = new Set<string>()
  let match: RegExpExecArray | null
  SCENE_BLOCK_RE.lastIndex = 0
  // eslint-disable-next-line no-cond-assign
  while ((match = SCENE_BLOCK_RE.exec(content)) !== null) {
    const separator = '，'
    const parts = match[1].split(separator)
    if (parts[0])
      places.add(parts[0].trim())
  }
  return [...places]
}
