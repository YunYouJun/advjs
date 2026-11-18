import { assertCreativeSourcePath } from './validation'

export interface CreativeNarrativeQuote { path: string, line: number, endLine: number, text: string }
/** A proposed interpretation, with optional literal witnesses; never an execution result. */
export interface CreativeNarrativeConcern {
  path: string
  line: number
  expected: string
  actual: string
  suggestion: string
  evidence?: { expected: CreativeNarrativeQuote, actual: CreativeNarrativeQuote }
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Invalid narrative concern authority')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 4000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError('Invalid narrative concern text')
  return value
}
function line(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 100000)
    throw new TypeError('Invalid narrative source line')
  return Number(value)
}
function quote(value: unknown): CreativeNarrativeQuote {
  const item = object(value, ['path', 'line', 'endLine', 'text'])
  const path = text(item.path, 200)
  assertCreativeSourcePath(path)
  const start = line(item.line)
  const end = line(item.endLine)
  if (end < start || end - start >= 32)
    throw new TypeError('Invalid narrative source span')
  return { path, line: start, endLine: end, text: text(item.text, 4000).replace(/\r\n/g, '\n') }
}
export function creativeNarrativeQuoteMatches(quote: CreativeNarrativeQuote, files: Readonly<Record<string, string>>): boolean {
  const content = files[quote.path]
  if (content === undefined)
    return false
  const rows = content.replace(/\r\n/g, '\n').split('\n')
  return quote.endLine <= rows.length && rows.slice(quote.line - 1, quote.endLine).join('\n') === quote.text
}
export function creativeNarrativeSourceStatus(concern: CreativeNarrativeConcern, files: Readonly<Record<string, string>>): 'matched' | 'unanchored' | 'changed' {
  if (!concern.evidence)
    return 'unanchored'
  return creativeNarrativeQuoteMatches(concern.evidence.expected, files) && creativeNarrativeQuoteMatches(concern.evidence.actual, files) ? 'matched' : 'changed'
}
/** Historical decoding preserves old unanchored proposals; new witnesses must match frozen source. */
export function parseCreativeNarrativeConcern(value: unknown, files?: Readonly<Record<string, string>>): CreativeNarrativeConcern {
  const item = object(value, ['path', 'line', 'expected', 'actual', 'suggestion', 'evidence'])
  const path = text(item.path, 200)
  assertCreativeSourcePath(path)
  const position = line(item.line)
  const evidence = item.evidence === undefined ? undefined : object(item.evidence, ['expected', 'actual'])
  const concern: CreativeNarrativeConcern = { path, line: position, expected: text(item.expected), actual: text(item.actual), suggestion: text(item.suggestion), ...(evidence ? { evidence: { expected: quote(evidence.expected), actual: quote(evidence.actual) } } : {}) }
  if (concern.evidence && (concern.evidence.actual.path !== path || concern.evidence.actual.line !== position))
    throw new TypeError('Narrative concern location differs from its actual witness')
  if (files && (!(path in files) || position > files[path].split('\n').length || creativeNarrativeSourceStatus(concern, files) === 'changed'))
    throw new TypeError('Narrative concern does not match frozen source')
  return concern
}
