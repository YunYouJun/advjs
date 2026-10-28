import type { CreativeEvaluationInput, CreativeEvaluationMessage, CreativeEvaluationModel } from '../src/evaluation/execution'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createCreativeEvaluationWorkspace, createCreativeSingleAgentEvaluator, CREATIVE_EVALUATION_TOOLS_VERSION, CREATIVE_SINGLE_PROMPT_VERSION } from '../src/evaluation/execution'

const frozen = JSON.parse(readFileSync(new URL('./fixtures/creative-team/v2/project.json', import.meta.url), 'utf8'))
const chapter = 'adv/chapters/station.adv.md'
const broken = frozen.files[chapter].replace('stay#ending-stay', 'absent#ending-stay')
const budget = { maxTotalTokens: 12000, maxMicroCny: 1000000, deadlineMs: 180000 }
const description = { model: 'local-fixture', prompt: CREATIVE_SINGLE_PROMPT_VERSION, parser: 'action-fixture', executor: 'executor-fixture', safety: 'safety-fixture', pricing: 'price-fixture', runtime: 'local-test', configurationFingerprint: 'fixture-only', inputBound: 'fixture-only', seedHandling: 'independent-attempt-label' as const }
const versions = { model: description.model, prompts: description.prompt, tools: CREATIVE_EVALUATION_TOOLS_VERSION, runtime: 'local-test', project: 'frozen-v2' }
function input(mode: 'A' | 'B' = 'B'): CreativeEvaluationInput {
  return { key: `local-06:1729:${mode}`, mode, seed: 1729, input: { id: 'local-06', category: 'local', prompt: '修复悬空跳转', checks: ['两个结局可达'] }, project: { ...structuredClone(frozen), files: { ...frozen.files, [chapter]: broken } } }
}
function harness(steps: (string | object | Error)[], after?: () => void) {
  const evidence = new Map<string, any>()
  const messages: CreativeEvaluationMessage[][] = []
  const remaining: unknown[] = []
  const model: CreativeEvaluationModel = {
    authoringInstructions: '本地明示模型替身；不验证真实创作品质',
    describe: () => ({ ...description }),
    async complete(request) {
      messages.push(structuredClone(request.messages) as CreativeEvaluationMessage[])
      remaining.push({ ...request.remaining })
      const step = steps[messages.length - 1]
      if (step instanceof Error)
        throw step
      if (step === undefined)
        throw new Error('Unexpected extra model call')
      after?.()
      return { status: 'confirmed', text: typeof step === 'string' ? step : JSON.stringify(step), finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 3, providerCostMicroCny: 2 } }
    },
  }
  const evaluator = createCreativeSingleAgentEvaluator({ model, sink: { async write(name, value) {
    evidence.set(name, structuredClone(value))
    return name
  } } })
  return { evaluator, evidence, messages, remaining }
}
const repair = { action: 'revise', workItem: 'jump-fix', reason: '修复真实诊断定位的错误目标', changes: [{ path: chapter, before: broken, after: frozen.files[chapter] }] }
const scenarios = [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }]

describe('continuous single-agent evaluation and common isolated tools', () => {
  it('returns actual compiler diagnostics to the same context, repairs and independently reaches both endings', async () => {
    const h = harness([{ action: 'compile', reason: '先定位悬空引用' }, repair, { action: 'playtest', reason: '实际复测两个结局', scenarios }, { action: 'finish', summary: '修复并复测；媒体未播放' }])
    const source = input()
    const result = await h.evaluator.run(source, { budget, versions, signal: new AbortController().signal })
    expect(result).toMatchObject({ outcome: 'completed', usability: { compiled: true, specifiedEndingsReached: 2, mediaPlayback: 'unverified' }, consumption: { inputTokens: 4, outputTokens: 4, totalTokens: 12, costMicroCny: 8, toolCalls: 5, reworkRounds: 0 }, author: { edits: 0, confirmations: 0 } })
    expect(h.messages.map(items => items.length)).toEqual([2, 4, 6, 8])
    expect(h.messages[3].slice(0, 6)).toEqual(h.messages[2])
    expect(h.messages[1][3].content).toContain('absent')
    expect(h.messages[3][7].content).toContain('actualEnding')
    expect(JSON.parse(h.messages[2][5].content).toolResult).toMatchObject({ appliedPaths: [chapter] })
    expect(JSON.parse(h.messages[2][5].content).toolResult).not.toHaveProperty('files')
    expect(h.remaining[1]).toMatchObject({ maxTotalTokens: budget.maxTotalTokens - 3, maxMicroCny: budget.maxMicroCny - 2 })
    const final = h.evidence.get(`${source.key}/final.json`)
    expect(final.audit.report.executions.map((item: any) => item.actualEnding)).toEqual(frozen.specifiedEndings)
    expect(final.audit.report.executions[0].trace.some((item: any) => item.source?.path === chapter)).toBe(true)
    expect(source.project.files[chapter]).toBe(broken)
    expect(frozen.files[chapter]).not.toContain('absent')
  })

  it('a has one generation and the same independent audit rejects an unfixed proposal', async () => {
    const h = harness([{ action: 'finish', summary: '模型自称完成并不算证据', changes: [] }])
    const result = await h.evaluator.run(input('A'), { budget, versions, signal: new AbortController().signal })
    expect(h.messages).toHaveLength(1)
    expect(result).toMatchObject({ outcome: 'generation-quality', stop: 'independent-audit-failed', usability: { compiled: false }, consumption: { totalTokens: 3, costMicroCny: 2, toolCalls: 2 } })
  })

  it('rejects a multi-file conflict, duplicate target and host path without partial writes', async () => {
    const workspace = createCreativeEvaluationWorkspace(input().project)
    const before = await workspace.snapshot()
    for (const changes of [
      [{ path: chapter, before: broken, after: frozen.files[chapter] }, { path: 'adv/world.md', before: 'wrong', after: 'overwrite' }],
      [{ path: chapter, before: broken, after: 'a' }, { path: chapter, before: broken, after: 'b' }],
      [{ path: '../secret', before: null, after: 'escape' }],
    ]) {
      await expect(workspace.revise(changes)).rejects.toThrow()
      expect(await workspace.snapshot()).toEqual(before)
    }
  })

  it('preserves portable read-only project documentation while refusing model changes to it', async () => {
    const source = input().project
    const workspace = createCreativeEvaluationWorkspace({ ...source, files: { ...source.files, 'ASSETS.md': 'License and source notes' } })
    expect((await workspace.snapshot()).files['ASSETS.md']).toBe('License and source notes')
    await expect(workspace.revise([{ path: 'ASSETS.md', before: 'License and source notes', after: 'overwrite' }])).rejects.toThrow('source path')
    expect((await workspace.snapshot()).files['ASSETS.md']).toBe('License and source notes')
  })

  it('keeps malformed replies and tool rejection in context so B can repair without an invisible retry', async () => {
    const h = harness(['not JSON', repair, { action: 'finish', summary: '已修订' }])
    const result = await h.evaluator.run(input(), { budget, versions, signal: new AbortController().signal })
    expect(result.outcome).toBe('completed')
    expect(result.consumption.totalTokens).toBe(9)
    expect(h.messages[1][2]).toEqual({ role: 'assistant', content: 'not JSON' })
    expect(h.messages[1][3].content).toContain('error')
  })

  it('does not invent zero usage or retry an unknown provider result', async () => {
    const h = harness([new Error('Provider outcome unknown')])
    const source = input()
    await expect(h.evaluator.run(source, { budget, versions, signal: new AbortController().signal })).rejects.toThrow('unknown')
    expect(h.messages).toHaveLength(1)
    expect(h.evidence.has(`${source.key}/call-1-intent.json`)).toBe(true)
    expect(h.evidence.has(`${source.key}/final.json`)).toBe(false)
  })

  it('records confirmed usage after cancellation and never dispatches another call', async () => {
    const controller = new AbortController()
    const h = harness([repair], () => controller.abort())
    const result = await h.evaluator.run(input(), { budget, versions, signal: controller.signal })
    expect(result).toMatchObject({ outcome: 'cancelled', consumption: { totalTokens: 3, costMicroCny: 2 } })
    expect(h.messages).toHaveLength(1)
    const final = h.evidence.get(`${input().key}/final.json`)
    expect(final.project.files[chapter]).toBe(broken)
  })

  it('offers initial drafts and two revisions per work item without treating all file writes as global rework', async () => {
    const first = frozen.files['adv/outline.md']
    const draft = (workItem: string, before: string, after: string) => ({ action: 'revise', workItem, reason: '隔离创作', changes: [{ path: 'adv/outline.md', before, after }] })
    const h = harness([draft('outline', first, 'one'), draft('cast-notes', 'one', 'two'), draft('outline', 'two', 'three'), draft('outline', 'three', 'four'), draft('outline', 'four', 'must-not-write'), { action: 'finish', summary: '保留已验证版本' }])
    const source = input()
    source.project = { ...source.project, files: { ...source.project.files, [chapter]: frozen.files[chapter] } }
    const result = await h.evaluator.run(source, { budget, versions, signal: new AbortController().signal })
    expect(result).toMatchObject({ outcome: 'completed', consumption: { reworkRounds: 2, toolCalls: 7 } })
    expect(h.evidence.get(`${source.key}/final.json`).project.files['adv/outline.md']).toBe('four')
    expect(h.messages[5].at(-1)?.content).toContain('two rework rounds exhausted')
  })

  it('preflights exact source and service versions without generating', async () => {
    const h = harness([])
    const project = input().project
    const workspace = createCreativeEvaluationWorkspace(project)
    const effective = { ...versions, project: (await workspace.snapshot()).revision }
    expect(await h.evaluator.preflight({ modes: ['A', 'B'], versions: effective, project })).toMatchObject({ ready: true, noDispatch: true })
    expect(await h.evaluator.preflight({ modes: ['B', 'C'], versions: effective, project })).toMatchObject({ ready: false })
    expect(await h.evaluator.preflight({ modes: ['B'], versions, project })).toMatchObject({ ready: false })
    expect(h.messages).toHaveLength(0)
  })

  it('refuses C or mismatched versions before a model call', async () => {
    const h = harness([])
    await expect(h.evaluator.run({ ...input(), mode: 'C' }, { budget, versions, signal: new AbortController().signal })).rejects.toThrow('actual creative-team')
    await expect(h.evaluator.run(input(), { budget, versions: { ...versions, model: 'another-model' }, signal: new AbortController().signal })).rejects.toThrow('versions')
    expect(h.messages).toHaveLength(0)
  })
})
