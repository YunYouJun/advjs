import type { CreativePlaytestSource } from './playtest-contracts'
import { assertCreativeSourcePath } from './validation'

export const CREATIVE_PLAYTEST_VOICE_STATUSES = ['missing', 'unselected', 'stale', 'unavailable', 'ready', 'unresolved'] as const
export interface CreativePlaytestVoiceRow {
  address: string
  lineId?: string
  speakerId: string
  source?: CreativePlaytestSource
  status: typeof CREATIVE_PLAYTEST_VOICE_STATUSES[number]
  takes: number
  profileMissing: boolean
  selected?: { takeId: string, assetId: string, sha256: string }
}
/** A bounded, historical author-host inventory; byte matching never certifies playback. */
export interface CreativePlaytestVoiceCoverage {
  verification: 'author-host-byte-check'
  snapshotRevision: string
  locale: string
  complete: boolean
  rows: readonly CreativePlaytestVoiceRow[]
  rowsOmitted: number
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Invalid playtest voice authority')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError('Invalid playtest voice text')
  return value
}
function count(value: unknown, max = 100000): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new TypeError('Invalid playtest voice count')
  return Number(value)
}

export function parseCreativePlaytestVoiceCoverage(value: unknown): CreativePlaytestVoiceCoverage {
  const root = object(value, ['verification', 'snapshotRevision', 'locale', 'complete', 'rows', 'rowsOmitted'])
  if (root.verification !== 'author-host-byte-check' || typeof root.complete !== 'boolean' || !/^sha256:[a-f0-9]{64}$/.test(String(root.snapshotRevision))
    || !Array.isArray(root.rows) || root.rows.length > 128 || new TextEncoder().encode(JSON.stringify(value)).length > 16384) {
    throw new TypeError('Invalid playtest voice coverage')
  }
  const rows = root.rows.map((value): CreativePlaytestVoiceRow => {
    const item = object(value, ['address', 'lineId', 'speakerId', 'source', 'status', 'takes', 'profileMissing', 'selected'])
    const address = text(item.address)
    if (!/^[\w.-]+#[\w.$-]+$/.test(address) || !CREATIVE_PLAYTEST_VOICE_STATUSES.includes(item.status as CreativePlaytestVoiceRow['status']) || typeof item.profileMissing !== 'boolean')
      throw new TypeError('Invalid playtest voice row')
    const source = item.source === undefined ? undefined : object(item.source, ['path', 'line', 'column'])
    const selected = item.selected === undefined ? undefined : object(item.selected, ['takeId', 'assetId', 'sha256'])
    if (source)
      assertCreativeSourcePath(text(source.path))
    if (source && ((source.line !== undefined && count(source.line) < 1) || (source.column !== undefined && count(source.column) < 1)))
      throw new TypeError('Invalid playtest voice source position')
    if (selected && !/^[a-f0-9]{64}$/.test(String(selected.sha256)))
      throw new TypeError('Invalid playtest voice digest')
    const takes = count(item.takes)
    if ((['ready', 'stale', 'unavailable'].includes(String(item.status)) && !selected) || (selected && !takes)
      || (item.status === 'missing' && takes !== 0) || (item.status === 'unselected' && (!takes || selected)) || (item.status !== 'unresolved' && !item.lineId)) {
      throw new TypeError('Inconsistent playtest voice selection')
    }
    return { address, ...(item.lineId === undefined ? {} : { lineId: text(item.lineId) }), speakerId: text(item.speakerId), status: item.status as CreativePlaytestVoiceRow['status'], takes, profileMissing: item.profileMissing, ...(source ? { source: { path: text(source.path), ...(source.line === undefined ? {} : { line: count(source.line) }), ...(source.column === undefined ? {} : { column: count(source.column) }) } } : {}), ...(selected ? { selected: { takeId: text(selected.takeId), assetId: text(selected.assetId), sha256: text(selected.sha256) } } : {}) }
  })
  if (new Set(rows.map(item => item.address)).size !== rows.length)
    throw new TypeError('Duplicate playtest voice address')
  return { verification: 'author-host-byte-check', snapshotRevision: text(root.snapshotRevision), locale: text(root.locale, 64), complete: root.complete, rows, rowsOmitted: count(root.rowsOmitted) }
}

/** Keep issues before matching bytes, with explicit omissions instead of oversized reports. */
export function createCreativePlaytestVoiceCoverage(input: Omit<CreativePlaytestVoiceCoverage, 'verification' | 'rowsOmitted'>): CreativePlaytestVoiceCoverage {
  const rows: CreativePlaytestVoiceRow[] = []
  const ordered = [...input.rows.filter(item => item.status !== 'ready'), ...input.rows.filter(item => item.status === 'ready')]
  let bytes = 512
  for (const row of ordered) {
    const size = new TextEncoder().encode(JSON.stringify(row)).length + 1
    if (rows.length >= 128 || bytes + size > 16384)
      break
    rows.push(row)
    bytes += size
  }
  return parseCreativePlaytestVoiceCoverage({ ...input, verification: 'author-host-byte-check', rows, rowsOmitted: input.rows.length - rows.length })
}
