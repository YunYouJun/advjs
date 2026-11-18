import type { AdvCharacter } from '@advjs/types'

/**
 * CSV export utilities.
 * Generates RFC 4180 compliant CSV strings.
 */

// Characters that require a field to be quoted
const NEEDS_QUOTING_RE = /[",\n\r]/
const DOUBLE_QUOTE_RE = /"/g

/**
 * Escape a CSV field value: wrap in quotes if it contains comma, quote, or newline.
 * Double any embedded quotes.
 */
function escapeField(value: string): string {
  if (NEEDS_QUOTING_RE.test(value))
    return `"${value.replace(DOUBLE_QUOTE_RE, '""')}"`
  return value
}

/**
 * Serialize a 2D array into a CSV string.
 */
export function stringifyCSV(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeField).join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeField).join(','))
  }
  return `${lines.join('\n')}\n`
}

/**
 * Export characters as CSV.
 */
export function exportCharactersToCSV(characters: AdvCharacter[]): string {
  const headers = [
    'id',
    'name',
    'tags',
    'aliases',
    'faction',
    'personality',
    'appearance',
    'background',
    'concept',
    'speechStyle',
  ]

  const rows = characters.map(c => [
    c.id,
    c.name,
    (c.tags ?? []).join(';'),
    (c.aliases ?? []).join(';'),
    c.faction ?? '',
    c.personality ?? '',
    c.appearance ?? '',
    c.background ?? '',
    c.concept ?? '',
    c.speechStyle ?? '',
  ])

  return stringifyCSV(headers, rows)
}

/**
 * Export timeline entries as CSV.
 */
export function exportTimelineToCSV(entries: { date: string, period?: string, kind: string, type?: string, summary: string, mood?: string, characterId?: string, characterIds?: string[], diaryContent?: string }[]): string {
  const headers = [
    'date',
    'period',
    'kind',
    'type',
    'characterIds',
    'mood',
    'content',
  ]

  const rows = entries.map(e => [
    e.date,
    e.period ?? '',
    e.kind,
    e.type ?? '',
    (e.characterIds ?? (e.characterId ? [e.characterId] : [])).join(';'),
    e.mood ?? '',
    e.diaryContent ?? e.summary,
  ])

  return stringifyCSV(headers, rows)
}

/**
 * Export character relationships as CSV.
 */
export function exportRelationshipsToCSV(characters: AdvCharacter[]): string {
  const headers = [
    'sourceId',
    'sourceName',
    'targetId',
    'type',
    'description',
  ]

  const rows: string[][] = []
  for (const c of characters) {
    for (const rel of c.relationships ?? []) {
      rows.push([
        c.id,
        c.name,
        rel.targetId,
        rel.type ?? '',
        rel.description ?? '',
      ])
    }
  }

  return stringifyCSV(headers, rows)
}
