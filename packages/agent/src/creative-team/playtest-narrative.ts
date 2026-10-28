import type { CreativeArtifact, CreativeTeamRun } from './contracts'
import type { CreativeNarrativeConcern } from './narrative-concerns'
import { creativeArtifactExpectedFiles } from './milestones'
import { creativeNarrativeSourceStatus, parseCreativeNarrativeConcern } from './narrative-concerns'

export interface CreativeNarrativeDecision { index: number, status: 'confirmed' | 'dismissed', reason: string }
export interface CreativePlaytestNarrativeRow {
  index: number
  concern: CreativeNarrativeConcern
  sourceStatus: 'matched' | 'unanchored' | 'changed'
  decision?: Omit<CreativeNarrativeDecision, 'index'>
}
export interface CreativePlaytestNarrativeReview {
  verification: 'author-source-review'
  snapshotRevision: string
  artifactId: string
  fingerprint: string
  rows: readonly CreativePlaytestNarrativeRow[]
  rowsOmitted: number
}
export interface CreativePlaytestNarrativeInput {
  run: CreativeTeamRun
  artifactId: string
  fingerprint: string
  decisions: readonly CreativeNarrativeDecision[]
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Invalid narrative review authority')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError('Invalid narrative review text')
  return value
}
function count(value: unknown, max = 32): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new TypeError('Invalid narrative review index')
  return Number(value)
}
function decision(value: unknown): NonNullable<CreativePlaytestNarrativeRow['decision']> {
  const item = object(value, ['status', 'reason'])
  if (!['confirmed', 'dismissed'].includes(String(item.status)))
    throw new TypeError('Invalid narrative review decision')
  return { status: item.status as 'confirmed' | 'dismissed', reason: text(item.reason, 1000) }
}
export function parseCreativePlaytestNarrativeReview(value: unknown): CreativePlaytestNarrativeReview {
  const root = object(value, ['verification', 'snapshotRevision', 'artifactId', 'fingerprint', 'rows', 'rowsOmitted'])
  if (root.verification !== 'author-source-review' || !/^sha256:[a-f0-9]{64}$/.test(String(root.snapshotRevision))
    || !Array.isArray(root.rows) || root.rows.length > 32 || new TextEncoder().encode(JSON.stringify(value)).length > 16384) {
    throw new TypeError('Invalid narrative review boundary')
  }
  const rows = root.rows.map((value): CreativePlaytestNarrativeRow => {
    const item = object(value, ['index', 'concern', 'sourceStatus', 'decision'])
    if (!['matched', 'unanchored', 'changed'].includes(String(item.sourceStatus)))
      throw new TypeError('Invalid narrative source status')
    const parsed = { index: count(item.index, 31), concern: parseCreativeNarrativeConcern(item.concern), sourceStatus: item.sourceStatus as CreativePlaytestNarrativeRow['sourceStatus'], ...(item.decision === undefined ? {} : { decision: decision(item.decision) }) }
    if ((parsed.sourceStatus === 'unanchored') !== !parsed.concern.evidence || (parsed.decision?.status === 'confirmed' && parsed.sourceStatus !== 'matched'))
      throw new TypeError('Unverified narrative source cannot be confirmed')
    return parsed
  })
  const rowsOmitted = count(root.rowsOmitted)
  if (new Set(rows.map(row => row.index)).size !== rows.length || rows.length + rowsOmitted > 32)
    throw new TypeError('Invalid narrative review coverage')
  return { verification: 'author-source-review', snapshotRevision: text(root.snapshotRevision), artifactId: text(root.artifactId), fingerprint: text(root.fingerprint), rows, rowsOmitted }
}

function proposal(input: Pick<CreativePlaytestNarrativeInput, 'run' | 'artifactId' | 'fingerprint'>, saved: Readonly<Record<string, string>>): CreativeArtifact & { output: { kind: 'playtest-plan', concerns: readonly CreativeNarrativeConcern[] } } {
  const artifact = input.run.artifacts.find(item => item.id === input.artifactId && item.fingerprint === input.fingerprint)
  if (!artifact || artifact.projectId !== input.run.plan.projectId || artifact.runId !== input.run.id || artifact.partner !== 'playtester'
    || artifact.output?.kind !== 'playtest-plan' || !['candidate', 'selected', 'adopted'].includes(artifact.status)
    || Object.entries(creativeArtifactExpectedFiles(artifact, input.run)).some(([path, content]) => (saved[path] ?? null) !== content)) {
    throw new Error('CREATIVE_NARRATIVE_SOURCE_CONFLICT')
  }
  return artifact as ReturnType<typeof proposal>
}

/** Capture explicit author judgements, without turning literal matching into a semantic verdict. */
export function createCreativePlaytestNarrativeReview(input: CreativePlaytestNarrativeInput, snapshot: { revision: string, files: Readonly<Record<string, string>> }, saved: Readonly<Record<string, string>>): CreativePlaytestNarrativeReview {
  const artifact = proposal(input, saved)
  if (!Array.isArray(input.decisions) || input.decisions.length > artifact.output.concerns.length || new Set(input.decisions.map(item => item.index)).size !== input.decisions.length)
    throw new TypeError('Invalid narrative author decisions')
  const decisions = new Map(input.decisions.map((item) => {
    const index = count(item.index, artifact.output.concerns.length - 1)
    return [index, decision({ status: item.status, reason: item.reason })]
  }))
  const rows: CreativePlaytestNarrativeRow[] = []
  const base = { verification: 'author-source-review' as const, snapshotRevision: snapshot.revision, artifactId: artifact.id, fingerprint: artifact.fingerprint }
  for (const [index, source] of artifact.output.concerns.entries()) {
    const concern = parseCreativeNarrativeConcern(source)
    const row = { index, concern, sourceStatus: creativeNarrativeSourceStatus(concern, snapshot.files), ...(decisions.has(index) ? { decision: decisions.get(index)! } : {}) }
    if (row.decision?.status === 'confirmed' && row.sourceStatus !== 'matched')
      throw new Error('CREATIVE_NARRATIVE_SOURCE_CONFLICT')
    if (new TextEncoder().encode(JSON.stringify({ ...base, rows: [...rows, row], rowsOmitted: artifact.output.concerns.length - rows.length - 1 })).length > 16384)
      break
    rows.push(row)
  }
  return parseCreativePlaytestNarrativeReview({ ...base, rows, rowsOmitted: artifact.output.concerns.length - rows.length })
}

/** Server verifies immutable proposal identity and literal witnesses, not the author's judgement. */
export function assertCreativePlaytestNarrativeSource(review: CreativePlaytestNarrativeReview, run: CreativeTeamRun, files: Readonly<Record<string, string>>, saved: Readonly<Record<string, string>>): void {
  const artifact = proposal({ ...review, run }, saved)
  if (review.rows.length + review.rowsOmitted !== artifact.output.concerns.length)
    throw new Error('CREATIVE_NARRATIVE_SOURCE_CONFLICT')
  for (const row of review.rows) {
    if (JSON.stringify(row.concern) !== JSON.stringify(parseCreativeNarrativeConcern(artifact.output.concerns[row.index])) || row.sourceStatus !== creativeNarrativeSourceStatus(row.concern, files))
      throw new Error('CREATIVE_NARRATIVE_SOURCE_CONFLICT')
  }
}
