import type { CreativeTeamClient } from '../creative-team/client'
import type { CreativeTeamLimits, CreativeTeamRun } from '../creative-team/contracts'
import type { CreativeEvaluationBudget, CreativeEvaluationInput, CreativeEvaluationModel, CreativeEvaluationModelDescription, CreativeEvaluationSink } from './execution'
import { canRequestCreativeDirectorSummary } from '../creative-team/orchestration'
import { creativePlaytestFindings } from '../creative-team/playtest-repair'
import { createCreativeEvaluationWorkspace, createCreativeSingleAgentEvaluator, CREATIVE_EVALUATION_TOOLS_VERSION } from './execution'

interface Versions { model: string, prompts: string, tools: string, runtime: string, project: string }
export interface CreativeEvaluationCrewBinding {
  describe: () => Promise<{ ready: boolean, issues: readonly string[], model: CreativeEvaluationModelDescription, teamPrompt: string, configurationFingerprint: string }>
  open: (input: { key: string, budget: CreativeEvaluationBudget, signal: AbortSignal, write: (name: string, value: unknown) => Promise<unknown> }) => Promise<{
    limits: CreativeTeamLimits
    client: Pick<CreativeTeamClient, 'availability' | 'start' | 'get' | 'decide' | 'recordPlaytest'>
    advance: (projectId: string, runId: string) => Promise<CreativeTeamRun>
    accounting: () => Promise<{ inputTokens: number, outputTokens: number, totalTokens: number, costMicroCny: number, modelCalls: number, receipts: readonly unknown[], failures: readonly { taskId: string, category: string, code: string }[] }>
  }>
}

/** Primary comparison uses the actual crew service; decisions below are benchmark policy, never human approval. */
export function createCreativeComparisonEvaluator(options: { model: CreativeEvaluationModel, crew: CreativeEvaluationCrewBinding, sink: CreativeEvaluationSink }) {
  const model = options.model.describe()
  async function identity() {
    const crew = await options.crew.describe()
    const prompts = `${model.prompt}+${crew.teamPrompt}`
    const issues = [...crew.issues]
    for (const key of ['model', 'runtime', 'pricing', 'inputBound', 'configurationFingerprint'] as const) {
      // The crew owns an additional orchestration fingerprint; its model fingerprint must match B exactly.
      if (crew.model[key] !== model[key])
        issues.push(`Single-agent and crew ${key} differ`)
    }
    return { crew, prompts, issues }
  }
  return {
    async preflight(input: { modes: readonly string[], versions: Versions, project: CreativeEvaluationInput['project'] }) {
      const current = await identity()
      const single = createCreativeSingleAgentEvaluator({ model: options.model, sink: options.sink, promptBundleVersion: current.prompts })
      const check = await single.preflight({ ...input, modes: input.modes.filter(mode => mode !== 'C') })
      const issues = [...check.issues, ...current.issues]
      if (input.modes.some(mode => !['A', 'B', 'C'].includes(mode)))
        issues.push('Unknown comparison mode')
      return { ready: check.ready && current.crew.ready && !issues.length, noDispatch: true, modes: ['A', 'B', 'C'], versions: check.versions, single: single.describe(), crew: current.crew, issues }
    },
    async run(input: CreativeEvaluationInput, context: { signal: AbortSignal, budget: CreativeEvaluationBudget, versions: Versions }) {
      const current = await identity()
      if (!current.crew.ready || current.issues.length || context.versions.prompts !== current.prompts || context.versions.model !== model.model || context.versions.runtime !== model.runtime || context.versions.tools !== CREATIVE_EVALUATION_TOOLS_VERSION)
        throw new TypeError('Comparison configuration is not aligned')
      if (input.mode !== 'C')
        return createCreativeSingleAgentEvaluator({ model: options.model, sink: options.sink, promptBundleVersion: current.prompts }).run(input, context)
      const startedAt = Date.now()
      const evidence: string[] = []
      let sequence = 0
      let hostTools = 0
      const save = async (name: string, value: unknown) => {
        const path = await options.sink.write(`${input.key}/${name}`, value)
        evidence.push(path)
        return path
      }
      const observe = (value: unknown) => save(`tool-${++sequence}.json`, value)
      const executionKey = `${input.key}:${globalThis.crypto.randomUUID()}`
      await save('input.json', { executionKey, input, versions: context.versions, crew: current.crew, benchmarkPolicy: 'first-single-candidate, actual-runtime, independent-review, bounded-system-rework-v1', authorConfirmations: 0 })
      const session = await options.crew.open({ key: executionKey, budget: context.budget, signal: context.signal, write: save })
      const project = await createCreativeEvaluationWorkspace(input.project).snapshot()
      const goal = `${input.input.prompt}\n评测执行规则：原始要求不变。导演按需选择已开放伙伴，包含独立 playtest-project，依赖所有制作任务；原始任务的语义质量须另由作者盲评。用相同固定素材，未生成媒体不能谎称已有。种子 ${input.seed} 仅是独立尝试标签。计划保留本目标、版本和预算；非人工的评测控制器会机械选定单个有效候选并执行真实核心检查，不代表作者采纳。`
      let run = await session.client.start({ protocolVersion: 1, project, goal, partner: 'director', limits: session.limits, locale: 'zh-CN' }, `evaluation:${executionKey}`)
      const decide = async (decision: Parameters<typeof session.client.decide>[2]) => {
        const key = `evaluation:${input.key}:${sequence + 1}`
        await observe({ actor: 'benchmark-policy', decision, key, runRevision: run.revision })
        run = await session.client.decide(project.id, run.id, decision, key)
      }
      await decide({ type: 'approve-plan' })
      let outcome: 'completed' | 'generation-quality' | 'system' | 'provider' | 'billing' | 'cancelled' = 'generation-quality'
      let stop = 'controller-limit'
      let reworkRounds = 0
      const tested = new Set<string>()
      const provenance = () => ({ run, artifacts: run.artifacts.filter(item => ['selected', 'adopted'].includes(item.status)).map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) })
      const workspace = () => {
        const source = provenance()
        return createCreativeEvaluationWorkspace(input.project, source.artifacts.length ? source : undefined)
      }
      const rework = async (taskId: string, reason: string, repair?: Parameters<typeof session.client.decide>[2] extends infer T ? T extends { type: 'request-rework', playtestRepair?: infer R } ? R : never : never) => {
        const task = run.tasks.find(item => item.taskId === taskId)!
        if (task.attempt >= 1 + run.plan.limits.maxReworkRounds)
          return false
        if (task.attempt)
          reworkRounds++
        await decide({ type: 'request-rework', taskId, reason: reason.slice(0, 3900), ...(repair ? { playtestRepair: repair } : {}) })
        return true
      }
      for (let step = 0; step < 512; step++) {
        await observe({ run })
        if (run.status === 'reconcile_required')
          throw new Error('Crew outcome requires reconciliation')
        const accounting = await session.accounting()
        if (context.signal.aborted || Date.now() - startedAt >= context.budget.deadlineMs) {
          outcome = 'cancelled'
          stop = 'cancelled'
          break
        }
        if (hostTools + run.toolCalls >= 126 || accounting.modelCalls >= 72) {
          stop = 'tool-or-model-limit'
          break
        }
        if (run.tasks.some(item => item.status === 'running')) {
          run = await session.advance(project.id, run.id)
          continue
        }
        const pendingReview = run.tasks.find(item => item.status === 'awaiting_review')
        if (pendingReview) {
          const artifacts = pendingReview.artifactIds.map(id => run.artifacts.find(item => item.id === id)!).filter(item => item?.status === 'candidate')
          if (artifacts.length !== 1) {
            stop = 'candidate-choice-needs-author'
            break
          }
          const artifact = artifacts[0]
          if (artifact.output?.kind === 'production-plan') {
            const plan = artifact.output.plan
            const reviewer = plan.tasks.find(item => item.capability === 'playtest-project')
            const ancestors = new Set<string>()
            const collect = (id: string) => {
              if (ancestors.has(id))
                return
              ancestors.add(id)
              plan.tasks.find(item => item.id === id)?.dependsOn.forEach(collect)
            }
            reviewer?.dependsOn.forEach(collect)
            const independent = reviewer && plan.tasks.filter(item => !['playtest-project', 'summarize-production'].includes(item.capability)).every(item => ancestors.has(item.id))
            if (!independent || plan.goal !== run.plan.goal || Object.entries(plan.limits).some(([key, value]) => value > run.plan.limits[key as keyof typeof plan.limits]) || plan.tasks.some(item => run.plan.tasks.some(existing => existing.id === item.id)) || plan.tasks.length + run.plan.tasks.length > plan.limits.maxTasks) {
              if (await rework(artifact.taskId, '本轮计划需要独立试玩员，依赖全部制作任务；包含 initial 在内不得超出总任务数。'))
                continue
              stop = 'invalid-review-dependencies'
              break
            }
            await decide({ type: 'accept-production-plan', artifactId: artifact.id })
          }
          else {
            await decide({ type: 'select', taskId: artifact.taskId, artifactIds: [artifact.id], reason: 'Benchmark policy selects the single schema-valid candidate; no human quality approval or project adoption' })
          }
          continue
        }
        const reviewer = run.artifacts.find(item => item.status === 'selected' && item.output?.kind === 'playtest-plan' && !tested.has(item.fingerprint))
        if (reviewer?.output?.kind === 'playtest-plan') {
          if ((run.playtests?.length ?? 0) > 30 || hostTools + run.toolCalls + 5 > 128) {
            stop = 'host-report-limit'
            break
          }
          tested.add(reviewer.fingerprint)
          const host = workspace()
          const proposed = await host.playtest(reviewer.output.scenarios, context.signal)
          hostTools++
          const audit = await host.audit(context.signal)
          hostTools += 2
          for (const report of [proposed, audit.report]) {
            await observe({ tool: 'actual-core-playtest', report })
            run = await session.client.recordPlaytest(project, run.id, report, `evaluation:${input.key}:report:${sequence}`)
          }
          const finding = creativePlaytestFindings(audit.report).find(item => item.kind === 'diagnostic' || item.kind === 'execution')
          if (finding) {
            const owner = run.plan.tasks.find(item => item.partner === 'writer')
            const report = run.playtests?.at(-1)
            if (owner && report && await rework(owner.id, '修复独立实际核心报告中的问题，保持原要求和指定结局；保留已选人物设定。', { reportId: report.id, snapshotRevision: audit.report.snapshotRevision, findingId: finding.id }))
              continue
            stop = 'unresolved-core-finding'
            break
          }
          if (proposed.executions.some(item => item.status !== 'passed')) {
            if (await rework(reviewer.taskId, '你的实际试玩输入没有通过；冻结的指定结局已通过，请修订复现步骤和预期，不要改写原始要求。'))
              continue
            stop = 'invalid-proposed-playtest'
            break
          }
          continue
        }
        const stale = run.tasks.find(item => item.status === 'stale')
        const failed = run.tasks.find(item => item.status === 'failed')
        if (stale || failed) {
          const task = (stale ?? failed)!
          const failure = accounting.failures.find(item => item.taskId === task.runtimeTaskId)
          const repairable = stale || failure?.category === 'product' || ['OUTPUT_PARSE_FAILED', 'PROJECT_VALIDATION_FAILED', 'CREATIVE_OUTPUT_REVIEW_FAILED'].includes(task.error?.code ?? '')
          if (repairable && await rework(task.taskId, `基于当前已选成果重新检查；原错误：${task.error?.message ?? '上游已修改'}`))
            continue
          stop = task.error?.code ?? task.status
          outcome = failure?.category === 'product' || /EVALUATION_BUDGET|OUTPUT|CREATIVE_INPUT/.test(stop)
            ? 'generation-quality'
            : /POINTS|BILLING|SETTLEMENT/.test(stop)
              ? 'billing'
              : /VERSION|MODEL_POLICY|IDENTITY|AUTH|INTERNAL/.test(stop)
                ? 'system'
                : failure?.category === 'provider' ? 'provider' : failure?.category === 'product' ? 'generation-quality' : 'system'
          break
        }
        const summary = run.plan.tasks.find(task => run.tasks.find(item => item.taskId === task.id)?.status === 'pending' && canRequestCreativeDirectorSummary(run, task.id))
        if (summary && await rework(summary.id, 'Benchmark policy requests the planned director summary of actual selected candidates, stored host reports and settled costs; no author completion claim'))
          continue
        if (run.tasks.every(item => item.status === 'completed')) {
          outcome = tested.size ? 'completed' : 'generation-quality'
          stop = tested.size ? 'finished' : 'missing-independent-review'
          break
        }
        if (run.tasks.some(item => item.status === 'blocked')) {
          stop = run.tasks.find(item => item.status === 'blocked')!.error?.code ?? 'blocked'
          break
        }
        run = await session.advance(project.id, run.id)
      }
      const host = workspace()
      const audit = await host.audit(context.signal)
      hostTools += 2
      if (context.signal.aborted) {
        outcome = 'cancelled'
        stop = 'cancelled'
      }
      if (outcome === 'completed' && (!audit.compiled || audit.specifiedEndingsReached !== input.project.specifiedEndings.length)) {
        outcome = 'generation-quality'
        stop = 'independent-audit-failed'
      }
      await decide({ type: 'cancel', reason: 'Benchmark sample recorded; stop the isolated session without author completion, adoption or further generation' })
      if (run.status === 'cancel_requested' || run.status === 'reconcile_required')
        run = await session.advance(project.id, run.id)
      if (run.status !== 'cancelled' || run.reservedMicroPoints !== 0)
        throw new Error('Benchmark closure requires settlement reconciliation')
      const accounting = await session.accounting()
      const consumption = { inputTokens: accounting.inputTokens, outputTokens: accounting.outputTokens, totalTokens: accounting.totalTokens, costMicroCny: accounting.costMicroCny, toolCalls: run.toolCalls + hostTools, latencyMs: Date.now() - startedAt, reworkRounds }
      const result = { caseId: input.input.id, category: input.input.category, seed: input.seed, mode: 'C' as const, versions: context.versions, outcome, stop, requirements: { status: 'unreviewed', checks: input.input.checks }, usability: { compiled: audit.compiled, referencesValid: audit.compiled, specifiedEndingsReached: audit.specifiedEndingsReached, mediaPlayback: audit.mediaPlayback }, consumption, author: { edits: 0, confirmations: 0, repeatedInstructions: 0 }, evidence }
      await save('final.json', { ...result, run, project: await host.snapshot(), audit, providerReceipts: accounting.receipts, runtimeFailures: accounting.failures, benchmarkSessionClosure: 'cancel-without-author-adoption' })
      return result
    },
  }
}
