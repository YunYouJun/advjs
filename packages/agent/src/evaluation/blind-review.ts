import type { CreativeEvaluationCategory } from './creative-team'
import { creativeMediaCanonical } from '../creative-team/media'
import { assertCreativeReadPath } from '../creative-team/validation'
import { summarizeCreativeVotes } from './preference'

type Mode = 'B' | 'C'
type Label = 'sample-1' | 'sample-2'
type Scores = Record<'narrative' | 'characters' | 'style' | 'playability', number>
interface Budget { maxTotalTokens: number, maxMicroCny: number, deadlineMs: number, maxMicroPoints?: number }
interface Task { id: string, category: CreativeEvaluationCategory, prompt: string, checks: string[] }
interface Sample {
  task: Task
  seed: number
  mode: Mode
  versions: Record<string, string>
  budget: Budget
  baseline: unknown
  outcome: string
  consumption: Record<string, number>
  material: { files: Record<string, string>, supplement: string }
  evidence: Record<string, string>
}
export interface CreativeBlindPair {
  id: string
  task: { prompt: string, checks: string[] }
  samples: Record<Label, Sample['material']>
}
export interface CreativeBlindPacket {
  schemaVersion: 1
  id: string
  fingerprint: string
  ledgerCommitment: string
  qualityScale: Record<keyof Scores, string>
  pairs: CreativeBlindPair[]
}
export interface CreativeBlindLedger {
  schemaVersion: 1
  packetId: string
  packetFingerprint: string
  nonce: string
  fingerprint: string
  scope: 'fixture' | 'real-evaluation'
  seeds: number[]
  pairs: { id: string, fingerprint: string, task: Task, seed: number, modes: Record<Label, Mode>, sources: Record<Mode, Pick<Sample, 'evidence' | 'versions' | 'budget' | 'outcome' | 'consumption'>>, explicitModeMarkers: string[] }[]
  excluded: { caseId: string, category: CreativeEvaluationCategory, seed: number, reason: string, sources: Partial<CreativeBlindLedger['pairs'][number]['sources']> }[]
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new TypeError('Expected a blind-review object')
  return value as Record<string, unknown>
}
function member<const T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T))
    throw new TypeError('Unknown comparison identity or outcome')
  return value as T
}
function array(value: unknown, maximum = 144): unknown[] {
  if (!Array.isArray(value) || value.length > maximum)
    throw new TypeError('Expected a bounded review collection')
  return value
}
function pick(value: unknown, names: readonly string[]) {
  const source = record(value)
  return Object.fromEntries(names.filter(name => source[name] !== undefined).map((name) => {
    const item = source[name]
    if (!(typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)) || (Array.isArray(item) && item.length <= 256 && item.every(value => typeof value === 'string'))))
      throw new TypeError('Creative advice fields must contain text or numeric data')
    return [name, item]
  }))
}
function text(value: unknown, limit = 32000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit)
    throw new TypeError('Expected bounded review text')
  return value
}
function integer(value: unknown, positive = false): number {
  if (!Number.isSafeInteger(value) || Number(value) < (positive ? 1 : 0))
    throw new TypeError('Expected verified integer accounting')
  return Number(value)
}
async function fingerprint(value: unknown) {
  const bytes = new TextEncoder().encode(creativeMediaCanonical(value))
  return `sha256:${Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')}`
}
function budget(value: unknown): Budget {
  const source = record(value)
  return { maxTotalTokens: integer(source.maxTotalTokens, true), maxMicroCny: integer(source.maxMicroCny, true), deadlineMs: integer(source.deadlineMs, true), ...(source.maxMicroPoints === undefined ? {} : { maxMicroPoints: integer(source.maxMicroPoints, true) }) }
}

/** Reads both actual final layouts: B stores identity in input.json; C also repeats it in final.json. */
export function parseCreativeBlindSample(value: { input: unknown, final: unknown, budget: unknown, evidence: Record<string, string>, providerCheck?: unknown }): Sample {
  const envelope = record(value.input)
  const input = record(envelope.input)
  const task = record(input.input)
  const final = record(value.final)
  const mode = member(input.mode, ['B', 'C'])
  const category = member(task.category, ['local', 'chapter', 'short-story'])
  let outcome = member(final.outcome, ['completed', 'generation-quality', 'system', 'provider', 'billing', 'cancelled'])
  for (const [key, expected] of Object.entries({ caseId: task.id, category: task.category, mode: input.mode, seed: input.seed })) {
    if (final[key] !== undefined && final[key] !== expected)
      throw new TypeError('Final comparison identity changed')
  }
  const versions = Object.fromEntries(['model', 'prompts', 'tools', 'runtime', 'project'].map(key => [key, text(record(envelope.versions)[key], 500)]))
  if (final.versions !== undefined && creativeMediaCanonical(final.versions) !== creativeMediaCanonical(versions))
    throw new TypeError('Final comparison versions changed')
  const consumption = Object.fromEntries(['inputTokens', 'outputTokens', 'totalTokens', 'costMicroCny', 'toolCalls', 'latencyMs', 'reworkRounds'].map(key => [key, integer(record(final.consumption)[key])]))
  if (consumption.totalTokens < consumption.inputTokens + consumption.outputTokens)
    throw new TypeError('Incomplete token accounting')
  if (value.providerCheck !== undefined) {
    const check = record(value.providerCheck)
    const result = record(check.result)
    if (check.executionOutcome !== final.outcome || !['system', 'provider', 'billing'].includes(String(result.outcome))
      || creativeMediaCanonical(record(result.consumption)) !== creativeMediaCanonical(record(final.consumption))) {
      throw new TypeError('Provider verification cannot upgrade an outcome or replace its accounting')
    }
    outcome = member(result.outcome, ['system', 'provider', 'billing'])
  }
  const files = Object.fromEntries(Object.entries(record(record(final.project).files)).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, content]) => {
    assertCreativeReadPath(path)
    if (typeof content !== 'string')
      throw new TypeError('Review projects only contain text source data')
    return [path, content]
  }))
  if (Object.keys(files).length > 128 || JSON.stringify(files).length > 128 * 1024)
    throw new TypeError('Review project exceeds the evaluation source limit')
  // Delivery evidence contains role IDs, versions, task counts and charges. Never
  // spread a saved output into public material, including its nested evidence.
  const supplement = mode === 'B'
    ? typeof final.summary === 'string' ? final.summary : ''
    : array(record(final.run).artifacts, 512).flatMap((item) => {
        const artifact = record(item)
        if (!['selected', 'adopted'].includes(String(artifact.status)) || artifact.output === undefined)
          return []
        const output = record(artifact.output)
        let creative: Record<string, unknown>
        if (output.kind === 'delivery-summary') {
          creative = { ...pick(output, ['summary', 'overview', 'risks', 'nextSteps']), deliverables: array(output.deliverables).map(entry => pick(entry, ['assessment'])) }
        }
        else if (output.kind === 'art-direction') {
          creative = { ...pick(output, ['summary', 'style']), requests: array(output.requests, 64).map(entry => pick(entry, ['assetId', 'kind', 'characterId', 'sceneId', 'locationId', 'expression', 'existingAssetId', 'width', 'height', 'prompt', 'constraints'])) }
        }
        else if (output.kind === 'voice-direction') {
          creative = { ...pick(output, ['summary', 'locale']), cast: array(output.cast, 32).map(entry => pick(entry, ['speakerId', 'designBrief', 'performance'])), dictionary: array(output.dictionary, 256).map(entry => pick(entry, ['term', 'pronunciation'])), lines: array(output.lines, 512).map(entry => ({ ...pick(entry, ['path', 'speakerId', 'text', 'instruction', 'line', 'lineId']), ...(record(entry).source === undefined ? {} : { source: pick(record(entry).source, ['line', 'endLine', 'text']) }) })) }
        }
        else {
          return []
        }
        return [JSON.stringify(creative, null, 2)]
      }).join('\n\n')
  if (supplement.length > 256 * 1024 || !Array.isArray(task.checks) || task.checks.length > 64 || task.checks.some(item => typeof item !== 'string' || item.length > 4000))
    throw new TypeError('Invalid creative review material')
  const checks = task.checks.map(item => String(item))
  return { task: { id: text(task.id, 128), category, prompt: text(task.prompt), checks }, seed: integer(input.seed, true), mode, versions, budget: budget(value.budget), baseline: input.project, outcome, consumption, material: { files, supplement }, evidence: structuredClone(value.evidence) }
}

async function packetFingerprint(packet: Omit<CreativeBlindPacket, 'fingerprint'>) {
  return fingerprint({ schemaVersion: packet.schemaVersion, id: packet.id, ledgerCommitment: packet.ledgerCommitment, qualityScale: packet.qualityScale, pairs: await Promise.all(packet.pairs.map(pair => fingerprint(pair))) })
}
function ledgerFingerprint(ledger: CreativeBlindLedger) {
  const { fingerprint: _fingerprint, packetFingerprint: _packetFingerprint, ...body } = ledger
  return fingerprint(body)
}

/** Public data never receives execution versions, costs, mode assignments or source file locations. */
export async function createCreativeBlindPacket(samples: readonly Sample[], options: { scope: CreativeBlindLedger['scope'], seeds: readonly number[], qualityScale: CreativeBlindPacket['qualityScale'] }) {
  if (!['fixture', 'real-evaluation'].includes(options.scope) || !options.seeds.length || options.seeds.some(seed => !Number.isSafeInteger(seed) || seed <= 0) || new Set(options.seeds).size !== options.seeds.length || samples.length > 144)
    throw new TypeError('Declare the review provenance and frozen seeds')
  if (Object.keys(options.qualityScale).sort().join(':') !== 'characters:narrative:playability:style' || Object.values(options.qualityScale).some(value => typeof value !== 'string' || !value.trim() || value.length > 4000))
    throw new TypeError('The four frozen quality dimensions are required')
  const grouped = new Map<string, Map<Mode, Sample>>()
  for (const sample of samples) {
    if (!options.seeds.includes(sample.seed))
      throw new TypeError('Review seed is outside the frozen suite')
    const key = JSON.stringify([sample.task.id, sample.seed])
    const pair = grouped.get(key) ?? new Map<Mode, Sample>()
    if (pair.has(sample.mode))
      throw new TypeError('Duplicate comparison sample')
    pair.set(sample.mode, sample)
    grouped.set(key, pair)
  }
  const packet: CreativeBlindPacket = { schemaVersion: 1, id: `review_${crypto.randomUUID()}`, fingerprint: '', ledgerCommitment: '', qualityScale: structuredClone(options.qualityScale), pairs: [] }
  const ledger: CreativeBlindLedger = { schemaVersion: 1, packetId: packet.id, packetFingerprint: '', nonce: crypto.randomUUID(), fingerprint: '', scope: options.scope, seeds: [...options.seeds], pairs: [], excluded: [] }
  for (const group of grouped.values()) {
    const left = group.get('B')
    const right = group.get('C')
    const identity = (left ?? right)!
    const sources = Object.fromEntries([...group.values()].map(sample => [sample.mode, { evidence: sample.evidence, versions: sample.versions, budget: sample.budget, outcome: sample.outcome, consumption: sample.consumption }])) as Partial<CreativeBlindLedger['pairs'][number]['sources']>
    if (!left || !right) {
      ledger.excluded.push({ caseId: identity.task.id, category: identity.task.category, seed: identity.seed, reason: 'missing-paired-result', sources })
      continue
    }
    if (creativeMediaCanonical({ task: left.task, baseline: left.baseline, versions: left.versions, budget: left.budget }) !== creativeMediaCanonical({ task: right.task, baseline: right.baseline, versions: right.versions, budget: right.budget }))
      throw new TypeError('Paired task, source, media, versions or budgets differ')
    const invalid = [left, right].find(sample => !['completed', 'generation-quality'].includes(sample.outcome) || sample.consumption.totalTokens > sample.budget.maxTotalTokens || sample.consumption.costMicroCny > sample.budget.maxMicroCny || sample.consumption.latencyMs > sample.budget.deadlineMs)
    if (invalid) {
      ledger.excluded.push({ caseId: identity.task.id, category: identity.task.category, seed: identity.seed, reason: ['completed', 'generation-quality'].includes(invalid.outcome) ? 'cap-exceeded' : invalid.outcome, sources })
      continue
    }
    const first = crypto.getRandomValues(new Uint8Array(1))[0]! & 1 ? right : left
    const second = first === left ? right : left
    const pair: CreativeBlindPair = { id: `pair_${crypto.randomUUID()}`, task: { prompt: left.task.prompt, checks: [...left.task.checks] }, samples: { 'sample-1': structuredClone(first.material), 'sample-2': structuredClone(second.material) } }
    const encoded = JSON.stringify(pair)
    const explicitModeMarkers = ['strong single agent', '强单Agent', 'multi-agent', 'benchmark-policy', ':1729:B', ':1729:C', 'mode B', 'mode C', '模式 B', '模式 C'].filter(marker => encoded.toLowerCase().includes(marker.toLowerCase()))
    packet.pairs.push(pair)
    ledger.pairs.push({ id: pair.id, fingerprint: await fingerprint(pair), task: left.task, seed: left.seed, modes: { 'sample-1': first.mode, 'sample-2': second.mode }, sources: sources as CreativeBlindLedger['pairs'][number]['sources'], explicitModeMarkers })
  }
  ledger.fingerprint = await ledgerFingerprint(ledger)
  packet.ledgerCommitment = ledger.fingerprint
  packet.fingerprint = await packetFingerprint(packet)
  ledger.packetFingerprint = packet.fingerprint
  if (new TextEncoder().encode(JSON.stringify(packet)).byteLength > 16 * 1024 * 1024)
    throw new TypeError('Split review materials into packets below 16 MiB')
  return { packet, ledger, form: { schemaVersion: 1, packetId: packet.id, packetFingerprint: packet.fingerprint, authorId: '', declaration: { human: false, independent: false, modeUndisclosed: false }, reviews: packet.pairs.map(pair => ({ pairId: pair.id, preferred: null, scores: { 'sample-1': { narrative: null, characters: null, style: null, playability: null }, 'sample-2': { narrative: null, characters: null, style: null, playability: null } }, notes: '' })) } }
}

/** Human declarations and names are operator evidence, not an automated verification of distinct people. */
export async function collectCreativeBlindReviews(packet: CreativeBlindPacket, ledger: CreativeBlindLedger, forms: readonly unknown[], options: { blindingReviewedBy?: string } = {}) {
  if (packet.schemaVersion !== 1 || ledger.schemaVersion !== 1 || packet.id !== ledger.packetId || packet.fingerprint !== ledger.packetFingerprint || ledger.fingerprint !== packet.ledgerCommitment || await ledgerFingerprint(ledger) !== ledger.fingerprint || await packetFingerprint(packet) !== packet.fingerprint || packet.pairs.length !== ledger.pairs.length)
    throw new TypeError('Blind materials changed after assignment')
  const pairs = new Map(ledger.pairs.map(pair => [pair.id, pair]))
  for (const pair of packet.pairs) {
    if (await fingerprint(pair) !== pairs.get(pair.id)?.fingerprint)
      throw new TypeError('Blind pair changed after assignment')
  }
  const judgments: { caseId: string, category: CreativeEvaluationCategory, seed: number, authorId: string, preferred: Mode | 'tie', scores: Record<Mode, Scores>, notes: string }[] = []
  const seen = new Set<string>()
  for (const raw of forms) {
    const form = record(raw)
    const authorId = text(form.authorId, 100).trim().normalize('NFC').toLowerCase()
    const declaration = record(form.declaration)
    if (form.schemaVersion !== 1 || form.packetId !== packet.id || form.packetFingerprint !== packet.fingerprint || declaration.human !== true || declaration.independent !== true || declaration.modeUndisclosed !== true || !Array.isArray(form.reviews))
      throw new TypeError('A complete independent human declaration is required')
    for (const rawReview of array(form.reviews)) {
      const review = record(rawReview)
      const pair = typeof review.pairId === 'string' ? pairs.get(review.pairId) : undefined
      const preferred = member(review.preferred, ['sample-1', 'sample-2', 'tie'])
      if (!pair)
        throw new TypeError('Unknown pair or missing human preference')
      const key = JSON.stringify([pair.id, authorId])
      if (seen.has(key))
        throw new TypeError('Duplicate human vote for the same pair')
      seen.add(key)
      const scores: Partial<Record<Mode, Scores>> = {}
      for (const label of ['sample-1', 'sample-2'] as const) {
        const rawScores = record(record(review.scores)[label])
        if (Object.keys(rawScores).sort().join(':') !== 'characters:narrative:playability:style' || Object.values(rawScores).some(value => !Number.isInteger(value) || Number(value) < 1 || Number(value) > 5))
          throw new TypeError('Both samples need four human scores from 1 to 5')
        scores[pair.modes[label]] = { ...rawScores } as Scores
      }
      if (review.notes !== undefined && (typeof review.notes !== 'string' || review.notes.length > 8000))
        throw new TypeError('Human notes must be text below 8000 characters')
      judgments.push({ caseId: pair.task.id, category: pair.task.category, seed: pair.seed, authorId, preferred: preferred === 'tie' ? 'tie' : pair.modes[preferred], scores: scores as Record<Mode, Scores>, notes: review.notes ?? '' })
    }
  }
  const byCategory = Object.fromEntries((['local', 'chapter', 'short-story'] as const).map(category => [category, summarizeCreativeVotes(judgments.filter(item => item.category === category))]))
  const incompletePairs = ledger.pairs.filter(pair => new Set(judgments.filter(item => item.caseId === pair.task.id && item.seed === pair.seed).map(item => item.authorId)).size < 2).map(pair => pair.id)
  const reviewedBy = options.blindingReviewedBy === undefined ? null : text(options.blindingReviewedBy, 100).trim()
  const markers = ledger.pairs.filter(pair => pair.explicitModeMarkers.length).map(pair => pair.id)
  const resources = [
    ...ledger.pairs.map(pair => ({ caseId: pair.task.id, category: pair.task.category, seed: pair.seed, excluded: false, sources: pair.sources })),
    ...ledger.excluded.map(pair => ({ ...pair, excluded: true })),
  ].flatMap(pair => Object.entries(pair.sources).map(([mode, source]) => ({ caseId: pair.caseId, category: pair.category, seed: pair.seed, mode, excluded: pair.excluded, ...source })))
  return { schemaVersion: 1, packetId: packet.id, scope: ledger.scope, judgments, byCategory, incompletePairs, excluded: ledger.excluded, resources, humanEvidence: ledger.scope === 'fixture' ? 'fixture-only, not author evidence' : judgments.length ? 'operator-declared human identities and reviews' : 'no human judgments supplied', blinding: { reviewedBy, explicitModeMarkers: markers, readyForInterpretation: ledger.scope === 'real-evaluation' && Boolean(reviewedBy) && !markers.length && !incompletePairs.length && judgments.length > 0 }, routingDecision: 'unchanged', remainingGates: ['verify distinct human authors and blinding', 'independent usability and critical-defect comparisons', 'actual cost, wallet and latency review', 'explicit product release decision'] }
}
