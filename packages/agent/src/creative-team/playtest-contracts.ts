import type { CreativePlaytestScenario } from './outputs'
import { parseCreativePlaytestScenarios } from './outputs'
import { assertCreativeSourcePath } from './validation'

export interface CreativePlaytestDiagnostic { code: string, severity: 'error' | 'warning', message: string, path?: string, line?: number, column?: number, suggestion?: string, certainty?: 'certain' | 'uncertain' }

export interface CreativePlaytestSource { path: string, line?: number, column?: number }
export interface CreativePlaytestObservation {
  sequence: number
  command: 'start' | 'next' | 'choose'
  choice?: { index: number, id: string, label: string }
  address: string
  source?: CreativePlaytestSource
  kind?: string
  status: 'idle' | 'playing' | 'waiting-choice' | 'waiting-activity' | 'ended' | 'error'
  text?: string
  options?: readonly { id: string, label: string }[]
  effects: readonly string[]
  variablesChanged: readonly string[]
  /** Includes silently entered anchors; never fabricated from expected results. */
  entered: readonly string[]
}
export interface CreativePlaytestExecution {
  scenario: CreativePlaytestScenario
  status: 'passed' | 'failed' | 'blocked' | 'cancelled'
  code: 'completed' | 'compile_failed' | 'ending_missing' | 'ending_mismatch' | 'choices_unused' | 'choice_required' | 'choice_invalid' | 'activity_requires_host' | 'runtime_error' | 'command_limit' | 'evidence_limit' | 'cancelled'
  reachedExpected: boolean
  terminalAddress?: string
  actualEnding?: string
  commands: number
  trace: readonly CreativePlaytestObservation[]
  error?: { code: string, message: string }
}
/** Execution evidence is separate from model output, which may only propose a plan. */
export interface CreativePlaytestReport {
  schemaVersion: 1
  producer: 'advjs-author-host'
  runnerVersion: 'creative-headless-v1'
  projectId: string
  baselineRevision: string
  snapshotRevision: string
  scope: 'saved' | 'candidate'
  artifacts: readonly { artifactId: string, fingerprint: string }[]
  program?: { id: string, hash: string }
  startedAt: number
  finishedAt: number
  limits: { maxCommandsPerScenario: number, maxTotalCommands: number, maxEvidenceBytes: number }
  diagnostics: readonly CreativePlaytestDiagnostic[]
  diagnosticsOmitted: number
  executions: readonly CreativePlaytestExecution[]
  /** Never claims rendering, audio playback, model consistency or exhaustive coverage. */
  unverified: readonly ['visual-rendering', 'audio-playback', 'host-activities', 'narrative-consistency', 'unspecified-paths']
}

export interface CreativePlaytestSummary {
  id: string
  projectId: string
  baselineRevision: string
  snapshotRevision: string
  scope: CreativePlaytestReport['scope']
  artifacts: CreativePlaytestReport['artifacts']
  runnerVersion: CreativePlaytestReport['runnerVersion']
  /** Authenticated author's host report; the service has not replayed or certified it. */
  verification: 'author-host'
  passed: number
  failed: number
  blocked: number
  cancelled: number
  createdAt: number
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key)))
    throw new TypeError('Invalid playtest report authority')
  return value as Record<string, unknown>
}
function text(value: unknown, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new TypeError('Invalid playtest report text')
  return value
}
function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max)
    throw new TypeError('Invalid playtest report number')
  return Number(value)
}
function array(value: unknown, max: number): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new TypeError('Invalid playtest report collection')
  return value
}
function member<const T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.includes(value as T))
    throw new TypeError('Invalid playtest report state')
  return value as T
}
function address(value: unknown): string {
  const result = text(value)
  if (!/^[\w.-]+#[\w.$-]+$/.test(result))
    throw new TypeError('Invalid playtest runtime address')
  return result
}
function references(value: unknown): CreativePlaytestReport['artifacts'] {
  const result = array(value, 256).map((item) => {
    const source = object(item, ['artifactId', 'fingerprint'])
    return { artifactId: text(source.artifactId), fingerprint: text(source.fingerprint) }
  })
  if (new Set(result.map(item => item.artifactId)).size !== result.length)
    throw new TypeError('Duplicate playtest input')
  return result
}
function location(value: unknown): CreativePlaytestSource {
  const source = object(value, ['path', 'line', 'column'])
  const path = text(source.path)
  assertCreativeSourcePath(path)
  return { path, ...(source.line === undefined ? {} : { line: integer(source.line, 100000) }), ...(source.column === undefined ? {} : { column: integer(source.column, 100000) }) }
}

/** Decode evidence without asserting that this authenticates its execution. Models cannot use this path. */
export function parseCreativePlaytestReport(value: unknown): CreativePlaytestReport {
  if (new TextEncoder().encode(JSON.stringify(value)).length > 262144)
    throw new TypeError('Playtest report exceeds the evidence limit')
  const root = object(value, ['schemaVersion', 'producer', 'runnerVersion', 'projectId', 'baselineRevision', 'snapshotRevision', 'scope', 'artifacts', 'program', 'startedAt', 'finishedAt', 'limits', 'diagnostics', 'diagnosticsOmitted', 'executions', 'unverified'])
  if (root.schemaVersion !== 1 || root.producer !== 'advjs-author-host' || root.runnerVersion !== 'creative-headless-v1')
    throw new TypeError('Unsupported playtest report protocol')
  const limits = object(root.limits, ['maxCommandsPerScenario', 'maxTotalCommands', 'maxEvidenceBytes'])
  const parsedLimits = { maxCommandsPerScenario: integer(limits.maxCommandsPerScenario, 512), maxTotalCommands: integer(limits.maxTotalCommands, 512), maxEvidenceBytes: integer(limits.maxEvidenceBytes, 196608) }
  if (Object.values(parsedLimits).some(value => value < 1))
    throw new TypeError('Invalid playtest limits')
  const diagnostics = array(root.diagnostics, 128).map((value): CreativePlaytestDiagnostic => {
    const item = object(value, ['code', 'severity', 'message', 'path', 'line', 'column', 'suggestion', 'certainty'])
    return { code: text(item.code), severity: member(item.severity, ['error', 'warning']), message: text(item.message, 4000), ...(item.path === undefined ? {} : location({ path: item.path, line: item.line, column: item.column })), ...(item.suggestion === undefined ? {} : { suggestion: text(item.suggestion, 4000) }), ...(item.certainty === undefined ? {} : { certainty: member(item.certainty, ['certain', 'uncertain']) }) }
  })
  const executions = array(root.executions, 12).map((value): CreativePlaytestExecution => {
    const item = object(value, ['scenario', 'status', 'code', 'reachedExpected', 'terminalAddress', 'actualEnding', 'commands', 'trace', 'error'])
    if (typeof item.reachedExpected !== 'boolean')
      throw new TypeError('Invalid playtest ending observation')
    const scenario = parseCreativePlaytestScenarios([item.scenario])[0]
    const trace = array(item.trace, parsedLimits.maxCommandsPerScenario).map((value): CreativePlaytestObservation => {
      const step = object(value, ['sequence', 'command', 'choice', 'address', 'source', 'kind', 'status', 'text', 'options', 'effects', 'variablesChanged', 'entered'])
      const choice = step.choice === undefined ? undefined : object(step.choice, ['index', 'id', 'label'])
      return { sequence: integer(step.sequence, 512), command: member(step.command, ['start', 'next', 'choose']), address: address(step.address), status: member(step.status, ['idle', 'playing', 'waiting-choice', 'waiting-activity', 'ended', 'error']), ...(choice ? { choice: { index: integer(choice.index, 31), id: text(choice.id), label: text(choice.label, 48000) } } : {}), ...(step.source === undefined ? {} : { source: location(step.source) }), ...(step.kind === undefined ? {} : { kind: text(step.kind) }), ...(step.text === undefined ? {} : { text: typeof step.text === 'string' && !step.text ? '' : text(step.text, 512000) }), ...(step.options === undefined
        ? {}
        : { options: array(step.options, 256).map((option) => {
            const data = object(option, ['id', 'label'])
            return { id: text(data.id), label: text(data.label, 48000) }
          }) }), effects: array(step.effects, 2048).map(item => text(item)), variablesChanged: array(step.variablesChanged, 2048).map(item => text(item, 48000)), entered: array(step.entered, 2048).map(address) }
    })
    const commands = integer(item.commands, parsedLimits.maxCommandsPerScenario)
    const status = member(item.status, ['passed', 'failed', 'blocked', 'cancelled'])
    const code = member(item.code, ['completed', 'compile_failed', 'ending_missing', 'ending_mismatch', 'choices_unused', 'choice_required', 'choice_invalid', 'activity_requires_host', 'runtime_error', 'command_limit', 'evidence_limit', 'cancelled'])
    if (trace.some((step, index) => step.sequence !== index + 1 || (step.command === 'start') !== (index === 0) || (step.command === 'choose') !== Boolean(step.choice)) || trace.length > commands || (commands !== trace.length && code !== 'evidence_limit'))
      throw new TypeError('Invalid playtest command sequence')
    const chosen = trace.flatMap(step => step.choice ? [step.choice.index] : [])
    if (chosen.some((value, index) => value !== scenario.choices[index]) || (status === 'passed' && (code !== 'completed' || !item.reachedExpected || item.actualEnding !== scenario.expectedEnding || trace.at(-1)?.status !== 'ended' || commands !== trace.length || chosen.length !== scenario.choices.length)))
      throw new TypeError('Inconsistent reported playtest result')
    if ((status === 'passed') !== (code === 'completed') || (status === 'cancelled') !== (code === 'cancelled')
      || item.reachedExpected !== trace.some(step => step.entered.includes(scenario.expectedEnding))
      || (item.terminalAddress !== undefined && (trace.at(-1)?.status !== 'ended' || trace.at(-1)?.address !== item.terminalAddress))) {
      throw new TypeError('Inconsistent reported ending evidence')
    }
    const error = item.error === undefined ? undefined : object(item.error, ['code', 'message'])
    return { scenario, status, code, reachedExpected: item.reachedExpected, commands, trace, ...(item.terminalAddress === undefined ? {} : { terminalAddress: address(item.terminalAddress) }), ...(item.actualEnding === undefined ? {} : { actualEnding: address(item.actualEnding) }), ...(error ? { error: { code: text(error.code), message: text(error.message, 4000) } } : {}) }
  })
  if (!executions.length || new Set(executions.map(item => item.scenario.id)).size !== executions.length || executions.reduce((sum, item) => sum + item.commands, 0) > parsedLimits.maxTotalCommands)
    throw new TypeError('Invalid playtest scope or shared command budget')
  if (executions.flatMap(item => item.trace).reduce((sum, item) => sum + new TextEncoder().encode(JSON.stringify(item)).length, 0) > parsedLimits.maxEvidenceBytes
    || new TextEncoder().encode(JSON.stringify(diagnostics)).length > 33000) {
    throw new TypeError('Playtest evidence exceeds its declared budget')
  }
  const unverified: CreativePlaytestReport['unverified'] = ['visual-rendering', 'audio-playback', 'host-activities', 'narrative-consistency', 'unspecified-paths']
  if (JSON.stringify(root.unverified) !== JSON.stringify(unverified))
    throw new TypeError('A headless report cannot claim media or exhaustive coverage')
  const program = root.program === undefined ? undefined : object(root.program, ['id', 'hash'])
  const artifacts = references(root.artifacts)
  if ((root.scope === 'candidate' && !artifacts.length) || (root.scope === 'saved' && artifacts.length))
    throw new TypeError('Invalid playtest candidate scope')
  const startedAt = integer(root.startedAt)
  const finishedAt = integer(root.finishedAt)
  if (finishedAt < startedAt || (!program && executions.some(item => item.commands || item.status === 'passed')))
    throw new TypeError('Invalid playtest execution metadata')
  if (diagnostics.some(item => item.severity === 'error') && executions.some(item => item.status === 'passed'))
    throw new TypeError('Blocking diagnostics cannot be presented as a passing execution')
  return { schemaVersion: 1, producer: 'advjs-author-host', runnerVersion: 'creative-headless-v1', projectId: text(root.projectId), baselineRevision: text(root.baselineRevision), snapshotRevision: text(root.snapshotRevision), scope: member(root.scope, ['saved', 'candidate']), artifacts, ...(program ? { program: { id: text(program.id), hash: text(program.hash) } } : {}), startedAt, finishedAt, limits: parsedLimits, diagnostics, diagnosticsOmitted: integer(root.diagnosticsOmitted), executions, unverified }
}

export function parseCreativePlaytestSummary(value: unknown): CreativePlaytestSummary {
  const item = object(value, ['id', 'projectId', 'baselineRevision', 'snapshotRevision', 'scope', 'artifacts', 'runnerVersion', 'verification', 'passed', 'failed', 'blocked', 'cancelled', 'createdAt'])
  return { id: text(item.id), projectId: text(item.projectId), baselineRevision: text(item.baselineRevision), snapshotRevision: text(item.snapshotRevision), scope: member(item.scope, ['saved', 'candidate']), artifacts: references(item.artifacts), runnerVersion: member(item.runnerVersion, ['creative-headless-v1']), verification: member(item.verification, ['author-host']), passed: integer(item.passed, 12), failed: integer(item.failed, 12), blocked: integer(item.blocked, 12), cancelled: integer(item.cancelled, 12), createdAt: integer(item.createdAt) }
}
