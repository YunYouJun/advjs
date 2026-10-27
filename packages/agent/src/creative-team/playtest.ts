import type { JsonObject, RuntimeAddress, RuntimeChoice, RuntimeProgram } from '@advjs/types'
import type { CreativeTeamRun } from './contracts'
import type { CreativePlaytestScenario } from './outputs'
import type { CreativePlaytestDiagnostic, CreativePlaytestExecution, CreativePlaytestObservation, CreativePlaytestReport } from './playtest-contracts'
import type { CreativeTeamStartRequest } from './wire'
import { compileProject, createAdvRuntime } from '@advjs/core'
import { computeAgentProjectRevision } from '../proposals/review'
import { parseCreativePlaytestScenarios } from './outputs'
import { parseCreativePlaytestReport } from './playtest-contracts'
import { creativePlaytestCandidateFiles } from './playtest-snapshot'
import { parseCreativeProject } from './wire'

function address(value: RuntimeAddress): string {
  return `${value.chapterId}#${value.nodeId}`
}

/** An anchor counts as an ending only when its unambiguous tail terminates there. */
function endingTail(program: RuntimeProgram, start: string, terminal: string, endings: ReadonlySet<string>): boolean {
  const seen = new Set<string>()
  let current = start
  while (!seen.has(current)) {
    if (current !== start && endings.has(current))
      return false
    if (current === terminal)
      return true
    seen.add(current)
    const [chapter, id] = current.split('#')
    const node = program.chapters[chapter]?.nodes[id]
    if (!node || !node.next || ['choices', 'end'].includes(node.kind) || (current !== start && node.kind === 'anchor') || node.kind.includes('/') || node.next.chapterId !== chapter)
      return false
    current = address(node.next)
  }
  return false
}

/** Executes only the real core runtime, with no go-to-ending shortcuts, plugins or host effects. */
export async function runCreativePlaytest(input: {
  project: CreativeTeamStartRequest['project']
  scenarios: readonly CreativePlaytestScenario[]
  candidate?: { run: CreativeTeamRun, artifacts: CreativePlaytestReport['artifacts'] }
}, options: { maxCommandsPerScenario?: number, maxTotalCommands?: number, maxEvidenceBytes?: number, signal?: AbortSignal, yieldControl?: () => Promise<void>, now?: () => number } = {}): Promise<CreativePlaytestReport> {
  const now = options.now ?? Date.now
  const startedAt = now()
  const project = parseCreativeProject(input.project)
  if (await computeAgentProjectRevision(project.files) !== project.revision)
    throw new Error('CREATIVE_SOURCE_CONFLICT')
  const scenarios = parseCreativePlaytestScenarios(input.scenarios)
  if (input.candidate && !input.candidate.artifacts.length)
    throw new Error('CREATIVE_EMPTY_CANDIDATE')
  const limits = { maxCommandsPerScenario: options.maxCommandsPerScenario ?? 256, maxTotalCommands: options.maxTotalCommands ?? 512, maxEvidenceBytes: options.maxEvidenceBytes ?? 196608 }
  for (const [key, value] of Object.entries(limits)) {
    if (!Number.isInteger(value) || value < 1 || value > (key === 'maxEvidenceBytes' ? 196608 : 512))
      throw new TypeError('Invalid deterministic playtest limit')
  }
  const files = input.candidate ? creativePlaytestCandidateFiles(input.candidate.run, project, input.candidate.artifacts) : project.files
  const snapshotRevision = await computeAgentProjectRevision(files)
  parseCreativeProject({ id: project.id, files, revision: snapshotRevision })
  const result = await compileProject({ id: project.id, files }, { staticAnalysis: true })
  const program = result.project.program
  const diagnostics: CreativePlaytestDiagnostic[] = []
  let diagnosticBytes = 0
  for (const source of [...result.diagnostics].sort((left, right) => Number(right.severity === 'error') - Number(left.severity === 'error'))) {
    const diagnostic: CreativePlaytestDiagnostic = { code: source.code, severity: source.severity, message: source.message.slice(0, 4000), ...(source.path ? { path: source.path } : {}), ...(source.line ? { line: source.line } : {}), ...(source.column ? { column: source.column } : {}), ...(source.suggestion ? { suggestion: source.suggestion.slice(0, 4000) } : {}), ...(source.certainty ? { certainty: source.certainty } : {}) }
    const bytes = new TextEncoder().encode(JSON.stringify(diagnostic)).length
    if (diagnosticBytes + bytes > 32768 || diagnostics.length >= 128)
      break
    diagnosticBytes += bytes
    diagnostics.push(diagnostic)
  }
  const executions: CreativePlaytestExecution[] = []
  const endings = new Set(scenarios.map(item => item.expectedEnding))
  let totalCommands = 0
  let evidenceBytes = 0
  const encoder = new TextEncoder()
  for (const scenario of scenarios) {
    const execution: CreativePlaytestExecution = { scenario: structuredClone(scenario), status: 'blocked', code: 'compile_failed', reachedExpected: false, commands: 0, trace: [] }
    executions.push(execution)
    if (options.signal?.aborted) {
      execution.status = 'cancelled'
      execution.code = 'cancelled'
      continue
    }
    if (!program)
      continue
    const [endingChapter, endingNode] = scenario.expectedEnding.split('#')
    if (!program.chapters[endingChapter]?.nodes[endingNode]) {
      execution.status = 'failed'
      execution.code = 'ending_missing'
      continue
    }
    let clock = 0
    const variables = result.project.game.variables
    const runtime = createAdvRuntime({ program, maxCheckpoints: 0, maxTraceEntries: limits.maxCommandsPerScenario, now: () => clock++, initialVariables: variables && typeof variables === 'object' && !Array.isArray(variables) ? variables as JsonObject : undefined })
    const trace: CreativePlaytestObservation[] = []
    let choicesUsed = 0
    const seen = new Set<string>()
    try {
      while (true) {
        if (options.signal?.aborted) {
          execution.status = 'cancelled'
          execution.code = 'cancelled'
          break
        }
        if (execution.commands >= limits.maxCommandsPerScenario || totalCommands >= limits.maxTotalCommands) {
          execution.code = 'command_limit'
          break
        }
        if (evidenceBytes >= limits.maxEvidenceBytes) {
          execution.code = 'evidence_limit'
          break
        }
        const before = runtime.state
        let choice: CreativePlaytestObservation['choice']
        let command: CreativePlaytestObservation['command'] = before.status === 'idle' ? 'start' : 'next'
        if (before.status === 'waiting-choice') {
          const index = scenario.choices[choicesUsed]
          if (index === undefined) {
            execution.code = 'choice_required'
            break
          }
          const choices = runtime.current?.data?.options as unknown as RuntimeChoice[]
          if (!choices[index]) {
            execution.status = 'failed'
            execution.code = 'choice_invalid'
            break
          }
          choice = { index, id: choices[index].id, label: choices[index].label }
          choicesUsed += 1
          command = 'choose'
        }
        const update = command === 'start' ? await runtime.start() : command === 'choose' ? await runtime.choose(choice!.id) : await runtime.next()
        execution.commands += 1
        totalCommands += 1
        const current = runtime.current
        const entered = update.state.visited.filter(item => !seen.has(item))
        entered.forEach(item => seen.add(item))
        const coreTrace = runtime.trace().at(-1)!
        const observation: CreativePlaytestObservation = { sequence: execution.commands, command, ...(choice ? { choice } : {}), address: address(update.state.cursor), source: result.sourceMap.nodes?.[address(update.state.cursor)], kind: current?.kind, status: update.state.status, ...(typeof current?.data?.text === 'string' ? { text: current.data.text } : {}), ...(current?.kind === 'choices' ? { options: (current.data!.options as unknown as RuntimeChoice[]).map(item => ({ id: item.id, label: item.label })) } : {}), effects: update.effects.map(effect => effect.type), variablesChanged: coreTrace.variableChanges.map(change => change.path), entered }
        const size = encoder.encode(JSON.stringify(observation)).length
        if (evidenceBytes + size > limits.maxEvidenceBytes) {
          execution.code = 'evidence_limit'
          break
        }
        evidenceBytes += size
        trace.push(observation)
        execution.reachedExpected = seen.has(scenario.expectedEnding)
        if (update.state.status === 'ended') {
          execution.terminalAddress = address(update.state.cursor)
          const actual = [...endings].filter(item => seen.has(item) && endingTail(program, item, execution.terminalAddress!, endings))
          if (actual.length === 1)
            execution.actualEnding = actual[0]
          execution.code = choicesUsed !== scenario.choices.length ? 'choices_unused' : execution.actualEnding === scenario.expectedEnding ? 'completed' : 'ending_mismatch'
          execution.status = execution.code === 'completed' ? 'passed' : 'failed'
          break
        }
        if (update.state.status === 'waiting-activity') {
          execution.code = 'activity_requires_host'
          break
        }
        if (update.state.status === 'error') {
          execution.code = 'runtime_error'
          execution.status = 'failed'
          execution.error = update.state.error
          break
        }
        if (totalCommands % 16 === 0)
          await options.yieldControl?.()
      }
    }
    catch (cause) {
      execution.status = 'failed'
      execution.code = 'runtime_error'
      execution.error = { code: 'ADV_CREATIVE_RUNTIME_ERROR', message: cause instanceof Error ? cause.message : String(cause) }
    }
    execution.trace = trace
  }
  return parseCreativePlaytestReport({ schemaVersion: 1, producer: 'advjs-author-host', runnerVersion: 'creative-headless-v1', projectId: project.id, baselineRevision: project.revision, snapshotRevision, scope: input.candidate ? 'candidate' : 'saved', artifacts: structuredClone(input.candidate?.artifacts ?? []), ...(program ? { program: { id: program.id, hash: program.hash } } : {}), startedAt, finishedAt: now(), limits, diagnostics, diagnosticsOmitted: result.diagnostics.length - diagnostics.length, executions, unverified: ['visual-rendering', 'audio-playback', 'host-activities', 'narrative-consistency', 'unspecified-paths'] })
}
