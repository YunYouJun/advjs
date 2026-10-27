import type { CreativePlaytestScenario } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativeTeamRun, parseCreativePlaytestReport, runCreativePlaytest } from '../src'
import frozen from './fixtures/creative-team/v2/project.json'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

const scenarios: CreativePlaytestScenario[] = [
  { id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' },
  { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' },
]
async function project(files: Record<string, string> = structuredClone(frozen.files)) {
  return { id: 'station', files, revision: await computeAgentProjectRevision(files) }
}

describe('independent deterministic creative playtest', () => {
  it('executes both frozen endings through actual core choices, retaining exact source positions without changing files', async () => {
    const input = await project()
    const before = structuredClone(input)
    const report = await runCreativePlaytest({ project: input, scenarios })
    expect(report.executions.map(item => [item.status, item.actualEnding])).toEqual([['passed', 'stay#ending-stay'], ['passed', 'leave#ending-leave']])
    expect(report.executions[0].trace.some(item => item.command === 'choose' && item.choice?.index === 0)).toBe(true)
    expect(report.executions[1].trace.some(item => item.command === 'choose' && item.choice?.index === 1)).toBe(true)
    expect(report.executions[0].trace).toContainEqual(expect.objectContaining({ text: '乔雨留下了姐姐的名字。', source: { path: 'adv/chapters/stay.adv.md', line: 3, column: 1 } }))
    expect(report.executions[0].terminalAddress).toBe('stay#end')
    expect(report.snapshotRevision).toBe(input.revision)
    expect(report.unverified).toContain('audio-playback')
    expect(input).toEqual(before)
  })

  it('reports broken references statically with their source and never fabricates a runtime path', async () => {
    const files = { ...frozen.files, 'adv/chapters/station.adv.md': '# 车站 {#arrival}\n\n- [坏链接](missing#end)' }
    const report = await runCreativePlaytest({ project: await project(files), scenarios })
    expect(report.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_RUNTIME_UNKNOWN_TARGET', path: 'adv/chapters/station.adv.md', line: 3 }))
    expect(report.executions.every(item => item.code === 'compile_failed' && item.trace.length === 0 && item.commands === 0)).toBe(true)
  })

  it('fails the wrong branch and identifies an existing but unreachable ending', async () => {
    const wrong = await runCreativePlaytest({ project: await project(), scenarios: [{ ...scenarios[0], choices: [1] }, scenarios[1]] })
    expect(wrong.executions[0]).toMatchObject({ status: 'failed', code: 'ending_mismatch', reachedExpected: false, actualEnding: 'leave#ending-leave' })
    const files = { ...frozen.files, 'adv/chapters/station.adv.md': '# 车站 {#arrival}\n\n- [只留下](stay#ending-stay)' }
    const unreachable = await runCreativePlaytest({ project: await project(files), scenarios })
    expect(unreachable.diagnostics.some(item => item.code === 'ADV_STATIC_UNREACHABLE_CHAPTER' && item.path === 'adv/chapters/leave.adv.md')).toBe(true)
    expect(unreachable.executions[1].status).toBe('failed')
  })

  it('does not count passing through a heading as reaching the expected terminal segment', async () => {
    const files = { 'adv.config.json': '{"schemaVersion":1,"root":"adv","format":"adv-md"}', 'adv/chapters/intro.adv.md': '# 假结局 {#fake}\n\n还没有结束。\n\n# 真结局 {#real}\n\n继续到这里才结束。' }
    const report = await runCreativePlaytest({ project: await project(files), scenarios: [{ id: 'misleading', choices: [], expectedEnding: 'intro#fake' }] })
    expect(report.executions[0]).toMatchObject({ status: 'failed', code: 'ending_mismatch', reachedExpected: true, terminalAddress: 'intro#end' })
  })

  it('accepts dotted chapter and anchor addresses supported by the actual runtime', async () => {
    const files = { 'adv.config.json': '{"schemaVersion":1,"root":"adv","format":"adv-md"}', 'adv/chapters/ep.1.adv.md': '# 结局 {#the.end}\n\n结束。' }
    const report = await runCreativePlaytest({ project: await project(files), scenarios: [{ id: 'dotted', choices: [], expectedEnding: 'ep.1#the.end' }] })
    expect(report.executions[0]).toMatchObject({ status: 'passed', actualEnding: 'ep.1#the.end' })
  })

  it('records canonical character dialogue and its core voice request without claiming audio playback', async () => {
    const files = { 'adv.config.json': '{"schemaVersion":1,"root":"adv","format":"adv-md"}', 'adv/characters/lin.character.md': '---\nid: lin\nname: 林舟\n---\n失物招领员。', 'adv/chapters/intro.adv.md': '# 结局 {#finish}\n\n@lin\n这封信终于送到了。' }
    const report = await runCreativePlaytest({ project: await project(files), scenarios: [{ id: 'dialogue', choices: [], expectedEnding: 'intro#finish' }] })
    expect(report.executions[0].status).toBe('passed')
    expect(report.executions[0].trace).toContainEqual(expect.objectContaining({ kind: 'dialog', text: '这封信终于送到了。', effects: expect.arrayContaining(['dialogue.voice']), source: { path: 'adv/chapters/intro.adv.md', line: 3, column: 1 } }))
    expect(report.unverified).toContain('audio-playback')
  })

  it('requires the complete explicit choice sequence and enforces a shared command and evidence budget', async () => {
    const missing = await runCreativePlaytest({ project: await project(), scenarios: [{ ...scenarios[0], choices: [] }] })
    expect(missing.executions[0].code).toBe('choice_required')
    const extra = await runCreativePlaytest({ project: await project(), scenarios: [{ ...scenarios[0], choices: [0, 0] }] })
    expect(extra.executions[0]).toMatchObject({ status: 'failed', code: 'choices_unused' })
    const limited = await runCreativePlaytest({ project: await project(), scenarios }, { maxTotalCommands: 1 })
    expect(limited.executions.every(item => item.code === 'command_limit')).toBe(true)
    expect(limited.executions.reduce((sum, item) => sum + item.commands, 0)).toBe(1)
    const evidence = await runCreativePlaytest({ project: await project(), scenarios }, { maxEvidenceBytes: 10 })
    expect(evidence.executions.every(item => item.status === 'blocked' && item.code === 'evidence_limit')).toBe(true)
    const abort = new AbortController()
    abort.abort()
    const cancelled = await runCreativePlaytest({ project: await project(), scenarios }, { signal: abort.signal })
    expect(cancelled.executions.every(item => item.status === 'cancelled' && item.commands === 0)).toBe(true)
  })

  it('tests selected candidates in isolation and rejects a changed source instead of silently rebasing the trace', async () => {
    const input = await project()
    const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: { ...creativePlan(), projectRevision: input.revision }, now: 0 })
    const path = 'adv/chapters/station.adv.md'
    run.artifacts = [creativeArtifact({ id: 'chapter', fingerprint: 'chapter-v1', taskId: 'script', partner: 'writer', kind: 'chapter', source: { projectId: input.id, revision: input.revision, files: { [path]: input.files[path] }, upstream: [] }, changes: [{ path, before: input.files[path], after: input.files[path].replace('你在等谁？', '修订后的候选对白。') }] })]
    const candidate = { run, artifacts: [{ artifactId: 'chapter', fingerprint: 'chapter-v1' }] }
    const report = await runCreativePlaytest({ project: input, scenarios, candidate })
    expect(report.scope).toBe('candidate')
    expect(report.snapshotRevision).not.toBe(input.revision)
    expect(report.executions[0].trace.map(item => item.text).join('\n')).toContain('修订后的候选对白。')
    expect(input.files[path]).not.toContain('修订后的候选对白')
    await expect(runCreativePlaytest({ project: await project({ ...input.files, [path]: '# 作者内容 {#arrival}' }), scenarios, candidate })).rejects.toThrow(/SOURCE_CONFLICT/)
  })

  it('rejects forged authority, missing trace evidence and claims beyond the headless execution scope', async () => {
    const report = await runCreativePlaytest({ project: await project(), scenarios })
    expect(() => parseCreativePlaytestReport({ ...report, chargedMicroPoints: 0 })).toThrow(/authority/)
    expect(() => parseCreativePlaytestReport({ ...report, unverified: [] })).toThrow(/media/)
    expect(() => parseCreativePlaytestReport({ ...report, executions: [{ ...report.executions[0], trace: [] }] })).toThrow()
    expect(() => parseCreativePlaytestReport({ ...report, limits: { ...report.limits, maxEvidenceBytes: 10 } })).toThrow(/budget/)
  })
})
