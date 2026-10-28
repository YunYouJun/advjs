import type { CreativeArtifact, CreativeTeamRun } from '../src/creative-team/contracts'
import type { CreativePartnerOutput } from '../src/creative-team/outputs'
import type { CreativePlaytestReport } from '../src/creative-team/playtest-contracts'
import type { CreativeEvaluationCrewBinding } from '../src/evaluation/crew'
import type { CreativeEvaluationInput, CreativeEvaluationModel } from '../src/evaluation/execution'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createCreativeTeamRun, nextCreativeTeamTask, reduceCreativeTeamRun } from '../src/creative-team/orchestration'
import { creativeOutputFileChanges } from '../src/creative-team/outputs'
import { requiredCreativeReviewCapabilities } from '../src/creative-team/validation'
import { createCreativeBootstrapPlan } from '../src/creative-team/wire'
import { createCreativeComparisonEvaluator } from '../src/evaluation/crew'
import { CREATIVE_EVALUATION_TOOLS_VERSION, CREATIVE_SINGLE_PROMPT_VERSION } from '../src/evaluation/execution'
import { computeAgentProjectRevision } from '../src/proposals/review'

const frozen = JSON.parse(readFileSync(new URL('./fixtures/creative-team/v2/project.json', import.meta.url), 'utf8'))
const chapter = 'adv/chapters/station.adv.md'
const budget = { maxTotalTokens: 64000, maxMicroCny: 6000000, deadlineMs: 900000 }
const description = { model: 'service-boundary-fixture', prompt: CREATIVE_SINGLE_PROMPT_VERSION, parser: 'fixture-action', executor: 'fixture', safety: 'fixture', pricing: 'fixture', runtime: 'fixture-runtime', inputBound: 'fixture', configurationFingerprint: 'fixture', seedHandling: 'independent-attempt-label' as const }
const teamPrompt = 'advjs-creative-team-2026-10-27-v7'
const input = (): CreativeEvaluationInput => ({ key: 'short-story-01:1729:C', mode: 'C', seed: 1729, input: { id: 'short-story-01', category: 'short-story', prompt: '修订车站短篇，保留两个结局', checks: ['人物一致', '双结局'] }, project: structuredClone(frozen) })

/** Explicit service-boundary substitute. Compiler, core and shared state reducer remain actual implementations. */
function harness(options: { brokenFirst?: boolean, unknown?: boolean, abort?: AbortController } = {}) {
  const evidence = new Map<string, any>()
  const reports: CreativePlaytestReport[] = []
  const decisions: any[] = []
  let run: CreativeTeamRun
  let calls = 0
  let clock = 0
  const modelComplete = vi.fn<CreativeEvaluationModel['complete']>()
  const model: CreativeEvaluationModel = { authoringInstructions: 'Explicit service fixture', describe: () => ({ ...description }), complete: modelComplete }
  const crew: CreativeEvaluationCrewBinding = {
    describe: async () => ({ ready: true, issues: [], model: description, teamPrompt, configurationFingerprint: 'service-fixture' }),
    async open() {
      const limits = { maxTasks: 24, maxToolCalls: 128, maxReworkRounds: 2, maxMicroPoints: 100000 }
      const refresh = () => structuredClone(run)
      return {
        limits,
        client: {
          availability: async () => ({ protocolVersion: 1, enabled: true, capabilities: ['plan-production', 'write-chapters', 'playtest-project'], serviceVersion: 'fixture-runtime', maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } }),
          async start(request) {
            run = createCreativeTeamRun({ id: 'crew-fixture', accountId: 'benchmark-fixture', plan: createCreativeBootstrapPlan(request), now: clock++ })
            return refresh()
          },
          get: async () => refresh(),
          async decide(_project, _run, action, decisionId) {
            decisions.push({ ...action, decisionId })
            run = reduceCreativeTeamRun(run, { ...action, decisionId }, clock++)
            return refresh()
          },
          async recordPlaytest(_project, _run, report) {
            reports.push(structuredClone(report))
            run = { ...run, playtests: [...(run.playtests ?? []), { id: `report-${reports.length}`, projectId: report.projectId, baselineRevision: report.baselineRevision, snapshotRevision: report.snapshotRevision, scope: report.scope, artifacts: report.artifacts, runnerVersion: report.runnerVersion, verification: 'author-host', passed: report.executions.filter(item => item.status === 'passed').length, failed: report.executions.filter(item => item.status === 'failed').length, blocked: 0, cancelled: 0, createdAt: clock++ }] }
            return refresh()
          },
        },
        async advance() {
          if (options.unknown)
            throw new Error('Uncertain service outcome requires reconciliation')
          const taskId = nextCreativeTeamTask(run)
          if (!taskId)
            return refresh()
          const task = run.plan.tasks.find(item => item.id === taskId)!
          const attempt = run.tasks.find(item => item.taskId === taskId)!.attempt + 1
          run = reduceCreativeTeamRun(run, { type: 'reserve-next', taskId, inputFingerprint: `${taskId}:${attempt}`, quotedMicroPoints: 100, toolCalls: 1 }, clock++)
          const state = run.tasks.find(item => item.taskId === taskId)!
          calls++
          let output: CreativePartnerOutput | undefined
          let changes: CreativeArtifact['changes'] = []
          if (task.capability === 'plan-production') {
            output = { kind: 'production-plan', summary: 'Service fixture plan', plan: { ...run.plan, tasks: [{ id: 'writer', partner: 'writer', capability: 'write-chapters', dependsOn: [], sourcePaths: Object.keys(frozen.files), instruction: '写作', expectedOutput: '章节' }, { id: 'review', partner: 'playtester', capability: 'playtest-project', dependsOn: ['writer'], sourcePaths: Object.keys(frozen.files), instruction: '独立检查', expectedOutput: '试玩提案' }] } }
          }
          else if (task.capability === 'write-chapters') {
            const after = frozen.files[chapter].replace('你在等谁？', '你在等谁回来？')
            changes = [{ path: chapter, before: frozen.files[chapter], after: options.brokenFirst && attempt === 1 ? after.replace('stay#ending-stay', 'absent#ending-stay') : after }]
          }
          else {
            output = { kind: 'playtest-plan', summary: 'Independent service fixture proposal', scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }], concerns: [] }
            changes = creativeOutputFileChanges(output, frozen.files)
          }
          const artifact: CreativeArtifact = { id: `${taskId}-${attempt}`, runId: run.id, projectId: run.plan.projectId, taskId, partner: task.partner, kind: output?.kind === 'production-plan' ? 'production-brief' : output?.kind ?? 'chapter', fingerprint: `${taskId}-fingerprint-${attempt}`, summary: 'Explicit service fixture', ...(output ? { output } : {}), changes, status: 'candidate', source: { projectId: run.plan.projectId, revision: run.plan.projectRevision, files: frozen.files, upstream: run.artifacts.filter(item => item.status === 'selected').map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) }, reviewCapabilities: [] }
          artifact.reviewCapabilities = requiredCreativeReviewCapabilities(artifact)
          run = reduceCreativeTeamRun(run, { type: 'settle-task', taskId, dispatchKey: state.dispatchKey!, status: 'completed', artifacts: [artifact], usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, providerCostMicroCny: 25, chargedMicroPoints: 25 } }, clock++)
          options.abort?.abort()
          return refresh()
        },
        async accounting() {
          if (options.unknown)
            throw new Error('Uncertain service outcome requires reconciliation')
          return { inputTokens: calls * 10, outputTokens: calls * 5, totalTokens: calls * 15, costMicroCny: calls * 25, modelCalls: calls, failures: [], receipts: [{ scope: 'explicit-service-fixture' }] }
        },
      }
    },
  }
  const evaluator = createCreativeComparisonEvaluator({ model, crew, sink: { async write(name, value) {
    if (evidence.has(name))
      throw new Error('Duplicate evidence')
    evidence.set(name, structuredClone(value))
    return name
  } } })
  const versions = { model: description.model, prompts: `${description.prompt}+${teamPrompt}`, tools: CREATIVE_EVALUATION_TOOLS_VERSION, runtime: description.runtime, project: 'root-version-set-by-preflight' }
  return { evaluator, evidence, reports, decisions, versions, modelComplete, calls: () => calls }
}

describe('crew comparison controller and actual isolated host', () => {
  it('uses candidate provenance, independently executes the fixed endings, stores reports and keeps author quality unreviewed', async () => {
    const h = harness()
    const source = input()
    const result = await h.evaluator.run(source, { budget, versions: h.versions, signal: new AbortController().signal })
    expect(result).toMatchObject({ outcome: 'completed', mode: 'C', usability: { compiled: true, specifiedEndingsReached: 2, mediaPlayback: 'unverified' }, requirements: { status: 'unreviewed' }, author: { confirmations: 0 }, consumption: { totalTokens: 45, costMicroCny: 75 } })
    expect(h.modelComplete).not.toHaveBeenCalled()
    expect(h.reports).toHaveLength(2)
    expect(h.reports.every(report => report.scope === 'candidate' && report.artifacts.some(item => item.artifactId === 'writer-1'))).toBe(true)
    expect(h.reports[1].executions.every(item => item.status === 'passed')).toBe(true)
    const final = h.evidence.get(`${source.key}/final.json`)
    expect(final.run.status).toBe('cancelled')
    expect(final.run.plan.goal).toContain(JSON.stringify(source.input.checks))
    expect(final.run.plan.goal).toContain(JSON.stringify(budget))
    expect(final.project.files[chapter]).toContain('等谁回来')
    expect(source.project.files).toEqual(frozen.files)
    expect(h.decisions.some(item => item.type === 'finish')).toBe(false)
  })

  it('returns a real core finding to the writer and retests a new independent reviewer after the repair', async () => {
    const h = harness({ brokenFirst: true })
    const result = await h.evaluator.run(input(), { budget, versions: h.versions, signal: new AbortController().signal })
    expect(result).toMatchObject({ outcome: 'completed', consumption: { reworkRounds: 2, totalTokens: 75 } })
    expect(h.reports.some(report => report.diagnostics.some(item => item.severity === 'error'))).toBe(true)
    expect(h.reports.at(-1)!.executions.every(item => item.status === 'passed')).toBe(true)
    expect(h.decisions.some(item => item.type === 'request-rework' && item.taskId === 'writer' && item.playtestRepair)).toBe(true)
    expect(h.decisions.some(item => item.type === 'request-rework' && item.taskId === 'review')).toBe(true)
  })

  it('does not turn an unknown service outcome into a zero-cost completed sample', async () => {
    const h = harness({ unknown: true })
    await expect(h.evaluator.run(input(), { budget, versions: h.versions, signal: new AbortController().signal })).rejects.toThrow('reconciliation')
    expect(h.calls()).toBe(0)
    expect(h.evidence.has(`${input().key}/final.json`)).toBe(false)
  })

  it('cancels its isolated sample without author closure and retains confirmed work after cancellation', async () => {
    const controller = new AbortController()
    const h = harness({ abort: controller })
    const result = await h.evaluator.run(input(), { budget, versions: h.versions, signal: controller.signal })
    expect(result).toMatchObject({ outcome: 'cancelled', consumption: { totalTokens: 15, costMicroCny: 25 } })
    expect(h.calls()).toBe(1)
    expect(h.decisions.at(-1).type).toBe('cancel')
    expect(h.decisions.some(item => item.type === 'finish')).toBe(false)
  })

  it('preflights the paired bundle and exact project without generation', async () => {
    const h = harness()
    const source = input()
    const versions = { ...h.versions, project: await computeAgentProjectRevision(source.project.files) }
    expect(await h.evaluator.preflight({ modes: ['B', 'C'], versions, project: source.project })).toMatchObject({ ready: true, modes: ['A', 'B', 'C'], noDispatch: true })
    expect(await h.evaluator.preflight({ modes: ['B', 'C'], versions: { ...versions, prompts: description.prompt }, project: source.project })).toMatchObject({ ready: false })
    expect(h.calls()).toBe(0)
    expect(h.modelComplete).not.toHaveBeenCalled()
  })
})
