/**
 * Monaco completion provider for `.character.md` frontmatter.
 *
 * The character frontmatter uses a structured `attributes.*` schema defined in
 * `@advjs/parser`. This provider surfaces the known field names inside the
 * YAML frontmatter block of a character file:
 *
 * - At the top level of `attributes:`, suggest `template`, `profile`,
 *   `galgame`, `rpg`, `custom`, `ai`.
 * - Inside each namespace, suggest the specific field names from the schema.
 * - When typing `template:`, suggest the enum values.
 *
 * The provider is registered against the YAML and Markdown language IDs so
 * that both plain Markdown editors and the custom `adv-markdown` language pick
 * it up when the user edits a character file.
 */

import type * as Monaco from 'monaco-editor'

/**
 * Leaf field definition for a single frontmatter namespace.
 * `enum` values turn into inline VALUE suggestions when the cursor is right
 * after a colon; otherwise we insert `key: ` as a property suggestion.
 */
export interface FieldDef {
  key: string
  detail: string
  doc?: string
  /** Rendered as `key: <snippet>` when the field inserts a default scaffold. */
  snippet?: string
  /** Enum values offered when the cursor is on the value side of `key:`. */
  enumValues?: string[]
}

/**
 * Top-level `attributes` keys.
 */
const ATTRIBUTES_ROOT: FieldDef[] = [
  { key: 'template', detail: 'enum', doc: 'Which template UI to show in Studio. One of: universal, galgame, rpg.', enumValues: ['universal', 'galgame', 'rpg'] },
  { key: 'profile', detail: 'object', doc: 'Universal profile fields shared by every template.' },
  { key: 'galgame', detail: 'object', doc: 'Romance / visual-novel extension fields.' },
  { key: 'rpg', detail: 'object', doc: 'Fantasy / RPG extension fields.' },
  { key: 'custom', detail: 'record', doc: 'User-defined custom fields, keyed by identifier.' },
  { key: 'ai', detail: 'object', doc: 'Controls how attributes are injected into AI prompts.' },
]

/**
 * Fields inside `attributes.profile`.
 */
const PROFILE_FIELDS: FieldDef[] = [
  { key: 'age', detail: 'number | string', doc: 'Age (numeric or free text like "unknown").' },
  { key: 'gender', detail: 'string' },
  { key: 'occupation', detail: 'string' },
  { key: 'personalityTags', detail: 'string[]', doc: 'Personality keywords rendered as chips.' },
  { key: 'appearanceSummary', detail: 'string', doc: 'One-line summary; full description stays in the Markdown body.' },
]

/**
 * Fields inside `attributes.galgame`.
 */
const GALGAME_FIELDS: FieldDef[] = [
  { key: 'birthday', detail: 'string', doc: 'MM-DD or free text.' },
  { key: 'bloodType', detail: 'string', doc: 'A / B / AB / O.' },
  { key: 'zodiac', detail: 'string' },
  { key: 'height', detail: 'string' },
  { key: 'likes', detail: 'string[]' },
  { key: 'dislikes', detail: 'string[]' },
  { key: 'affinityInitial', detail: 'number', doc: 'Initial value. Runtime changes belong in dynamicState.' },
]

/**
 * Fields inside `attributes.rpg`.
 */
const RPG_FIELDS: FieldDef[] = [
  { key: 'race', detail: 'string' },
  { key: 'class', detail: 'string' },
  { key: 'level', detail: 'number' },
  { key: 'stats', detail: 'object', doc: 'Six-dimensional stats: str / dex / int / con / wis / cha.' },
  { key: 'hpInitial', detail: 'number' },
  { key: 'mpInitial', detail: 'number' },
  { key: 'skills', detail: 'string[]' },
  { key: 'equipment', detail: 'string[]' },
  { key: 'alignment', detail: 'string' },
]

/**
 * Fields inside `attributes.rpg.stats`.
 */
const RPG_STATS_FIELDS: FieldDef[] = [
  { key: 'str', detail: 'number', doc: 'Strength' },
  { key: 'dex', detail: 'number', doc: 'Dexterity' },
  { key: 'int', detail: 'number', doc: 'Intelligence' },
  { key: 'con', detail: 'number', doc: 'Constitution' },
  { key: 'wis', detail: 'number', doc: 'Wisdom' },
  { key: 'cha', detail: 'number', doc: 'Charisma' },
]

/**
 * Fields inside `attributes.ai`.
 */
const AI_FIELDS: FieldDef[] = [
  { key: 'promptInject', detail: 'boolean', doc: 'When false, attributes are excluded from the AI system prompt.' },
  { key: 'excludeFields', detail: 'string[]', doc: 'Field paths (e.g. `galgame.bloodType`) to hide from AI prompts.' },
]

/**
 * Map of `attributes.<namespace>` → field defs.
 */
const NAMESPACE_FIELDS: Record<string, FieldDef[]> = {
  'profile': PROFILE_FIELDS,
  'galgame': GALGAME_FIELDS,
  'rpg': RPG_FIELDS,
  'rpg.stats': RPG_STATS_FIELDS,
  'ai': AI_FIELDS,
}

/** Matches "  " or "\t" indent of whitespace at the start of the line. */
const RE_LINE_INDENT = /^([ \t]*)/
/** Matches `<key>:` at the start of a line (key captured in group 1). */
const RE_KEY_COLON = /^[ \t]*([\w-]+)[ \t]*:/
/** Matches value-side completions: `key: <partial>` with partial captured. */
const RE_VALUE_CONTEXT = /^[ \t]*([\w-]+)[ \t]*:[ \t]*(\S*)$/
/** Frontmatter delimiter. */
const FRONTMATTER_DELIM = '---'

/**
 * Check whether the cursor is inside the opening `---` / `---` frontmatter
 * block at the top of the file. A file without a leading `---` has no
 * frontmatter and we return false.
 *
 * Pure helper — takes the lines as a plain string array for testability.
 * `lineNumber` is 1-based to match Monaco.
 */
export function isLineInFrontmatter(lines: string[], lineNumber: number): boolean {
  if (lines.length === 0)
    return false
  // Line 1 must be the opening delimiter.
  if (lines[0].trim() !== FRONTMATTER_DELIM)
    return false

  // Scan from line 2 looking for the closing delimiter.
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIM) {
      // Cursor must be strictly between the two delimiters (convert to 1-based).
      return lineNumber > 1 && lineNumber < i + 1
    }
  }
  // No closing delimiter yet — treat everything after line 1 as in-progress
  // frontmatter so completions still fire while the file is being typed.
  return lineNumber > 1
}

/**
 * Resolve the YAML path at `lineNumber` by walking backwards through the
 * frontmatter and tracking indentation. Returns the namespace path as a
 * dot-separated string (e.g. `attributes.galgame`) or `null` when the cursor
 * isn't inside an `attributes.*` subtree.
 *
 * Pure helper — takes the lines as a plain string array for testability.
 *
 * Algorithm: starting at the cursor line, walk backwards. A line is an
 * ancestor of the cursor iff its indent is strictly less than the current
 * "need" indent. Each ancestor tightens that bound, so siblings and children
 * of ancestors are automatically ignored.
 */
export function resolveFrontmatterPath(lines: string[], lineNumber: number, cursorIndent: number): string | null {
  const ancestors: string[] = []
  let needIndent = cursorIndent

  // Walk backwards from the line BEFORE the cursor (lineNumber is 1-based).
  for (let i = lineNumber - 2; i >= 0; i--) {
    const raw = lines[i]
    const trimmed = raw.trim()
    if (!trimmed || trimmed === FRONTMATTER_DELIM)
      continue
    const indent = (raw.match(RE_LINE_INDENT)?.[1].length) ?? 0
    const keyMatch = raw.match(RE_KEY_COLON)
    if (!keyMatch)
      continue
    // Strictly less → this is an ancestor of everything seen so far.
    if (indent < needIndent) {
      ancestors.push(keyMatch[1])
      needIndent = indent
    }
  }

  if (ancestors.length === 0)
    return null

  // ancestors is innermost → outermost; reverse to get root → leaf.
  const path = ancestors.reverse().join('.')
  if (!path.startsWith('attributes'))
    return null

  return path
}

/**
 * Look up field definitions for a resolved path.
 * Returns `null` when the path doesn't map to a known namespace.
 */
export function getFieldsForPath(path: string): FieldDef[] | null {
  if (path === 'attributes')
    return ATTRIBUTES_ROOT
  const nsKey = path.slice('attributes.'.length)
  return NAMESPACE_FIELDS[nsKey] ?? null
}

/**
 * Build completion items for a list of field definitions.
 */
function buildItems(
  fields: FieldDef[],
  range: Monaco.IRange,
): Monaco.languages.CompletionItem[] {
  return fields.map(f => ({
    label: f.key,
    kind: 10 /* CompletionItemKind.Property */,
    detail: f.detail,
    documentation: f.doc,
    insertText: f.snippet ? `${f.key}: ${f.snippet}` : `${f.key}: `,
    range,
  }))
}

/**
 * Create a completion provider for `.character.md` frontmatter.
 *
 * Cheap to instantiate — the provider carries no state and all fields are
 * module-scope constants, so we can register it multiple times (YAML,
 * Markdown, adv-markdown) without worry.
 */
export function createCharacterFrontmatterCompletionProvider(): Monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: [' ', ':', '\n'],

    provideCompletionItems(model, position) {
      // Only fire inside files that look like character markdown. We don't
      // have a robust way to detect the file kind from the model, so we use
      // the URI path as a best-effort hint and also allow any markdown/YAML
      // file that happens to declare an `attributes:` key.
      const uriPath = model.uri.path
      const looksLikeCharacterFile = uriPath.endsWith('.character.md')

      // Snapshot the document as plain lines so we can reuse pure helpers.
      const totalLines = model.getLineCount()
      const lines: string[] = []
      for (let i = 1; i <= totalLines; i++)
        lines.push(model.getLineContent(i))

      if (!isLineInFrontmatter(lines, position.lineNumber))
        return { suggestions: [] }

      const currentLine = model.getLineContent(position.lineNumber)
      const prefixOnLine = currentLine.slice(0, position.column - 1)
      const cursorIndent = (prefixOnLine.match(RE_LINE_INDENT)?.[1].length) ?? 0
      const word = model.getWordUntilPosition(position)
      const propertyRange: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      // ── Case A: value side of `key:` (e.g. after `template: `) ──
      // Look for "key: <partial>" on the current line before the cursor.
      const valueMatch = prefixOnLine.match(RE_VALUE_CONTEXT)
      if (valueMatch) {
        const key = valueMatch[1]
        const partial = valueMatch[2]
        // Find the field in any namespace that matches this key.
        const allDefs = [
          ...ATTRIBUTES_ROOT,
          ...PROFILE_FIELDS,
          ...GALGAME_FIELDS,
          ...RPG_FIELDS,
          ...RPG_STATS_FIELDS,
          ...AI_FIELDS,
        ]
        const match = allDefs.find(d => d.key === key && d.enumValues)
        if (match?.enumValues) {
          const valueRange: Monaco.IRange = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: position.column - partial.length,
            endColumn: position.column,
          }
          return {
            suggestions: match.enumValues.map(v => ({
              label: v,
              kind: 13 /* CompletionItemKind.EnumMember */,
              detail: `${key}: ${v}`,
              insertText: v,
              range: valueRange,
            })),
          }
        }
      }

      // ── Case B: property side — resolve the YAML path for context. ──
      const path = resolveFrontmatterPath(lines, position.lineNumber, cursorIndent)

      // If we're at the root (indent 0), and not inside attributes yet, offer
      // the `attributes` top-level key on character files.
      if (!path) {
        if (cursorIndent === 0 && looksLikeCharacterFile) {
          return {
            suggestions: [{
              label: 'attributes',
              kind: 10,
              detail: 'object',
              documentation: 'Structured attributes (opt-in). Nested under attributes.*.',
              insertText: 'attributes:\n  template: universal',
              range: propertyRange,
            }],
          }
        }
        return { suggestions: [] }
      }

      // ── Case C: inside an attributes.* subtree ──
      const fields = getFieldsForPath(path)
      if (fields)
        return { suggestions: buildItems(fields, propertyRange) }

      return { suggestions: [] }
    },
  }
}

/**
 * Register the character frontmatter completion provider against the
 * language IDs that Monaco uses for Markdown / YAML / our custom adv-markdown.
 *
 * Idempotent: every call returns a disposable and Monaco de-dupes language
 * registrations internally, but we guard at the caller level via a module
 * flag in `monacoSetup.ts`.
 */
export function registerCharacterFrontmatterCompletion(monaco: typeof Monaco): Monaco.IDisposable[] {
  const provider = createCharacterFrontmatterCompletionProvider()
  const disposables: Monaco.IDisposable[] = []
  for (const lang of ['yaml', 'markdown', 'adv-markdown']) {
    disposables.push(monaco.languages.registerCompletionItemProvider(lang, provider))
  }
  return disposables
}
