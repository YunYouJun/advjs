import type { CreativeTeamHandoff, CreativeTeamRun } from './contracts'
import type { CreativePlaytestReport, CreativePlaytestSource } from './playtest-contracts'
import { createCreativeTeamHandoff } from './candidates'
import { creativePlaytestCandidateFiles } from './playtest-snapshot'

/** An author selects one observed problem from a retained, versioned host report. */
export interface CreativePlaytestRepairReference {
  reportId: string
  snapshotRevision: string
  findingId: string
}

/** Bounded observations remain host claims, never a model's completion or media receipt. */
export interface CreativePlaytestFinding {
  id: string
  kind: 'diagnostic' | 'execution' | 'voice' | 'narrative'
  code: string
  expected: string
  actual: string
  source?: CreativePlaytestSource
  relatedSources?: readonly CreativePlaytestSource[]
  scenario?: { id: string, expectedEnding: string, choices: readonly number[] }
}

/** Frozen input is private to the handoff; public task state contains only references. */
export interface CreativePlaytestRepairContext {
  reference: CreativePlaytestRepairReference
  finding: CreativePlaytestFinding
  files: Readonly<Record<string, string | null>>
}

/** Reject caller-supplied findings, execution authority or mutable source content. */
export function parseCreativePlaytestRepairReference(value: unknown): CreativePlaytestRepairReference {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['reportId', 'snapshotRevision', 'findingId'].includes(key)))
    throw new TypeError('Invalid playtest repair reference')
  const source = value as Record<string, unknown>
  if (typeof source.reportId !== 'string' || !/^[\w-]{1,120}$/.test(source.reportId)
    || typeof source.snapshotRevision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(source.snapshotRevision)
    || typeof source.findingId !== 'string' || !/^(?:diagnostic:\d{1,3}|execution:\d{1,2}|voice:\d{1,3}|narrative:\d{1,2})$/.test(source.findingId)) {
    throw new TypeError('Invalid playtest repair identity')
  }
  return { reportId: source.reportId, snapshotRevision: source.snapshotRevision, findingId: source.findingId }
}

/** Offer observed problems; input mistakes and unperformed media checks are not evidence. */
export function creativePlaytestFindings(report: CreativePlaytestReport): CreativePlaytestFinding[] {
  const diagnostics: CreativePlaytestFinding[] = report.diagnostics.map((item, index) => ({
    id: `diagnostic:${index}`,
    kind: 'diagnostic',
    code: item.code,
    expected: item.suggestion?.slice(0, 512) || 'Project source should compile and satisfy static diagnostics',
    actual: item.message.slice(0, 1024),
    ...(item.path ? { source: { path: item.path, ...(item.line ? { line: item.line } : {}), ...(item.column ? { column: item.column } : {}) } } : {}),
  }))
  const voices: CreativePlaytestFinding[] = (report.voiceCoverage?.rows ?? []).flatMap((item, index) => item.status === 'ready'
    ? []
    : [{ id: `voice:${index}`, kind: 'voice' as const, code: `ADV_CREATIVE_VOICE_${item.status.toUpperCase()}`, expected: 'A unique authored line identity and a selected, current take with matching project bytes; actual playback still requires author review', actual: JSON.stringify({ address: item.address, lineId: item.lineId, speakerId: item.speakerId, locale: report.voiceCoverage!.locale, status: item.status, takes: item.takes, profileMissing: item.profileMissing, selected: item.selected }).slice(0, 1024), ...(item.source ? { source: item.source } : {}) }])
  const narrative: CreativePlaytestFinding[] = (report.narrativeReview?.rows ?? []).flatMap(row => row.decision?.status === 'confirmed' && row.sourceStatus === 'matched'
    ? [{ id: `narrative:${row.index}`, kind: 'narrative' as const, code: 'ADV_CREATIVE_NARRATIVE_AUTHOR_CONFIRMED', expected: row.concern.expected.slice(0, 512), actual: JSON.stringify({ interpretation: row.concern.actual, authorReason: row.decision.reason, suggestion: row.concern.suggestion }).slice(0, 3000), source: { path: row.concern.path, line: row.concern.line }, relatedSources: Object.values(row.concern.evidence!).map(quote => ({ path: quote.path, line: quote.line })) }]
    : [])
  return [...diagnostics, ...voices, ...narrative, ...report.executions.flatMap((item, index): CreativePlaytestFinding[] => ['ending_missing', 'ending_mismatch', 'runtime_error'].includes(item.code)
    ? [{
        id: `execution:${index}`,
        kind: 'execution',
        code: item.code,
        expected: item.scenario.expectedEnding,
        actual: JSON.stringify({ code: item.code, terminalAddress: item.terminalAddress, actualEnding: item.actualEnding, reachedExpected: item.reachedExpected, error: item.error }).slice(0, 1024),
        ...([...item.trace].reverse().find(step => step.source)?.source ? { source: [...item.trace].reverse().find(step => step.source)!.source } : {}),
        scenario: item.scenario,
      }]
    : [])]
}

/** Freeze the exact tested candidate text before rework invalidates its old artifact versions. */
export function prepareCreativePlaytestRepair(input: {
  run: CreativeTeamRun
  taskId: string
  reference: CreativePlaytestRepairReference
  report: CreativePlaytestReport
  project: { id: string, revision: string, files: Readonly<Record<string, string>> }
}): CreativeTeamHandoff {
  const { run, taskId, report, project } = input
  const reference = parseCreativePlaytestRepairReference(input.reference)
  const summary = run.playtests?.find(item => item.id === reference.reportId)
  const task = run.plan.tasks.find(item => item.id === taskId)
  const finding = creativePlaytestFindings(report).find(item => item.id === reference.findingId)
  if (!summary || !task || ['director', 'playtester'].includes(task.partner) || !finding
    || project.id !== run.plan.projectId || report.projectId !== project.id
    || project.revision !== report.baselineRevision || summary.snapshotRevision !== report.snapshotRevision
    || reference.snapshotRevision !== report.snapshotRevision) {
    throw new Error('CREATIVE_REPAIR_SOURCE_CONFLICT')
  }
  const tested = report.scope === 'candidate' ? creativePlaytestCandidateFiles(run, project, report.artifacts) : project.files
  const handoff = createCreativeTeamHandoff(run, taskId, { revision: project.revision, files: project.files })
  const paths = new Set([...task.sourcePaths, ...run.artifacts.filter(item => item.taskId === taskId).flatMap(item => item.changes.map(change => change.path)), ...report.executions.flatMap(item => item.trace.flatMap(step => step.source ? [step.source.path] : [])), ...(finding.source ? [finding.source.path] : [])])
  for (const source of finding.relatedSources ?? [])
    paths.add(source.path)
  if (finding.kind === 'voice') {
    for (const path of Object.keys(project.files).filter(path => /^adv\/(?:audio\/|characters\/|assets(?:\/|\.json$))/.test(path)))
      paths.add(path)
  }
  handoff.facts.files = Object.fromEntries([...paths].filter(path => path in project.files).map(path => [path, project.files[path]]))
  // Saved facts remain saved facts. Only exact differences from the tested snapshot are overlaid.
  const files = Object.fromEntries([...paths].filter(path => (project.files[path] ?? null) !== (tested[path] ?? null)).map(path => [path, tested[path] ?? null]))
  handoff.repair = { reference, finding, files }
  return handoff
}
