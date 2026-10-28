import type { CreativeTeamCapability } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativeTeamRun, creativeTextEditOutput, parseCreativeCandidateEditRequest, parseCreativePartnerOutputSnapshot, parseCreativeTeamRun, parseCreativeTextEditOutput, prepareCreativeCandidateEdit, reduceCreativeTeamRun, requiredCreativeReviewCapabilities, runCreativePlaytest } from '../src'
import frozen from './fixtures/creative-team/v2/project.json'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

async function fixture(capability: 'generate-outline' | 'generate-chapter-draft' = 'generate-outline', create = false) {
  const path = capability === 'generate-outline' ? 'adv/outline.md' : 'adv/chapters/station.adv.md'
  const files: Record<string, string> = { ...frozen.files }
  if (create)
    delete files[path]
  const revision = await computeAgentProjectRevision(files)
  const plan = { ...creativePlan(), projectRevision: revision, tasks: [{ id: 'text', partner: capability === 'generate-outline' ? 'director' as const : 'writer' as const, capability, dependsOn: [], sourcePaths: Object.keys(files), instruction: '旧文字能力', expectedOutput: '一个原始文字候选' }] }
  let run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan, now: 0 })
  run = reduceCreativeTeamRun(run, { type: 'approve-plan', decisionId: 'approve' }, 1)
  run = reduceCreativeTeamRun(run, { type: 'reserve-next', taskId: 'text', quotedMicroPoints: 100, toolCalls: 1, inputFingerprint: revision }, 2)
  const artifact = creativeArtifact({ id: 'text1', taskId: 'text', partner: plan.tasks[0]!.partner, kind: capability === 'generate-outline' ? 'outline' : 'chapter', status: 'candidate', fingerprint: 'text-v1', summary: '旧文字模型候选', source: { projectId: 'station', revision, files, upstream: [] }, changes: [{ path, before: files[path] ?? null, after: files[path] ?? '# 模型的大纲\n' }] })
  artifact.reviewCapabilities = requiredCreativeReviewCapabilities(artifact)
  run = reduceCreativeTeamRun(run, { type: 'settle-task', taskId: 'text', dispatchKey: run.tasks[0]!.dispatchKey!, status: 'completed', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30, providerCostMicroCny: 20, chargedMicroPoints: 40 }, artifacts: [artifact] }, 3)
  return { run, artifact, files, revision, path, facts: { files, revision }, project: { id: 'station', files, revision } }
}
const edit = { kind: 'source-text' as const, summary: '作者澄清两个结局', content: '# 作者的大纲\n\n留下与离开，各有清楚因果。\n' }

describe('legacy text candidate author revisions', () => {
  it.each(['generate-outline', 'generate-chapter-draft'] as const)('revises only the original %s target, preserves the paid original and waits for selection', async (capability) => {
    const f = await fixture(capability)
    const input = { artifactId: f.artifact.id, fingerprint: f.artifact.fingerprint, reason: '由作者改写源文字', output: edit }
    expect(creativeTextEditOutput(f.artifact, capability)).toEqual({ kind: 'source-text', summary: f.artifact.summary, content: f.artifact.changes[0]!.after })
    const prepared = prepareCreativeCandidateEdit(f.run, parseCreativeCandidateEditRequest(input), f.facts)
    const artifact = { ...prepared, id: 'author-text', fingerprint: 'author-v1' }
    const next = reduceCreativeTeamRun(f.run, { type: 'edit-candidate', artifact, decisionId: 'edit1', reason: input.reason, requestFingerprint: 'request1' }, 4)
    expect(prepared.output).toBeUndefined()
    expect(prepared.kind).toBe(f.artifact.kind)
    expect(prepared.changes).toEqual([{ path: f.path, before: f.files[f.path], after: edit.content }])
    expect(prepared.editedFrom).toEqual({ artifactId: f.artifact.id, fingerprint: f.artifact.fingerprint })
    expect(next.artifacts[0]!.status).toBe('stale')
    expect(next.artifacts[1]!.status).toBe('candidate')
    expect(next.tasks[0]!.status).toBe('awaiting_review')
    expect(next.chargedMicroPoints).toBe(f.run.chargedMicroPoints)
    expect(next.toolCalls).toBe(f.run.toolCalls)
    expect(f.artifact.status).toBe('candidate')
    expect(f.files[f.path]).not.toBe(edit.content)
    expect(parseCreativeTeamRun(next, { accountId: 'author1', projectId: 'station' }).artifacts[1]!.changes).toEqual(prepared.changes)
  })

  it('retains creation and empty-file semantics without accepting a new path or client provenance', async () => {
    const f = await fixture('generate-outline', true)
    const input = { artifactId: f.artifact.id, fingerprint: f.artifact.fingerprint, reason: '先保存空文字，再继续写作', output: { ...edit, content: '' } }
    const result = prepareCreativeCandidateEdit(f.run, input, f.facts)
    expect(result.changes).toEqual([{ path: 'adv/outline.md', before: null, after: '' }])
    expect(result.reviewCapabilities).toContain('create-source')
    expect(() => prepareCreativeCandidateEdit(f.run, { ...input, output: { ...edit, path: 'adv/audio/voice-ledger.json' } }, f.facts)).toThrow()
    expect(() => parseCreativeCandidateEditRequest({ ...input, source: { revision: 'invented' } })).toThrow()
    expect(() => prepareCreativeCandidateEdit(f.run, { ...input, output: { ...edit, before: 'invented' } }, f.facts)).toThrow()
  })

  it('refuses media, advice, structured output, deletions or unsupported legacy targets', async () => {
    const f = await fixture()
    for (const capability of ['direct-voice', 'check-consistency', 'simulate-roleplay'] as CreativeTeamCapability[])
      expect(creativeTextEditOutput(f.artifact, capability)).toBeUndefined()
    expect(creativeTextEditOutput({ ...f.artifact, kind: 'voice-direction' }, 'generate-outline')).toBeUndefined()
    expect(creativeTextEditOutput({ ...f.artifact, changes: [{ ...f.artifact.changes[0]!, after: null }] }, 'generate-outline')).toBeUndefined()
    expect(creativeTextEditOutput({ ...f.artifact, changes: [{ ...f.artifact.changes[0]!, path: 'adv/settings/game.json' }] }, 'generate-outline')).toBeUndefined()
    expect(creativeTextEditOutput({ ...f.artifact, changes: [...f.artifact.changes, ...f.artifact.changes] }, 'generate-outline')).toBeUndefined()
    expect(creativeTextEditOutput({ ...f.artifact, legacyResult: { capability: 'generate-outline', streamText: '建议' } }, 'generate-outline')).toBeUndefined()
    expect(() => parseCreativePartnerOutputSnapshot(edit, { projectId: 'station', projectRevision: f.revision, files: f.files, characterIds: [], limits: f.run.plan.limits })).toThrow('Unknown creative output kind')
  })

  it('rejects changed facts, occupied creation paths, stale versions, empty reasons and oversized wire text', async () => {
    const f = await fixture('generate-outline', true)
    const input = { artifactId: f.artifact.id, fingerprint: f.artifact.fingerprint, reason: '更明确', output: edit }
    expect(() => prepareCreativeCandidateEdit(f.run, input, { ...f.facts, files: { ...f.files, [f.path]: '作者刚写的新稿' } })).toThrow('SOURCE_CONFLICT')
    expect(() => prepareCreativeCandidateEdit(f.run, { ...input, fingerprint: 'wrong' }, f.facts)).toThrow('SOURCE_CONFLICT')
    expect(() => prepareCreativeCandidateEdit(f.run, { ...input, reason: '' }, f.facts)).toThrow()
    expect(() => prepareCreativeCandidateEdit({ ...f.run, status: 'completed' }, input, f.facts)).toThrow()
    expect(() => parseCreativeTextEditOutput({ ...edit, content: '中文'.repeat(10000) })).toThrow()
    expect(() => parseCreativeTextEditOutput({ ...edit, content: null })).toThrow()
  })

  it('preserves unchanged CRLF and opaque frontmatter as literal source rather than reserializing it', async () => {
    const f = await fixture('generate-chapter-draft')
    const content = '---\r\nid: station\r\ncustom: { keep: true }\r\n---\r\n# 车站 {#arrival}\r\n\r\n作者的原文。\r\n'
    const prepared = prepareCreativeCandidateEdit(f.run, { artifactId: f.artifact.id, fingerprint: f.artifact.fingerprint, reason: '保留完整文字格式', output: { ...edit, content } }, f.facts)
    expect(prepared.changes[0]!.after).toBe(content)
  })

  it('compiles and executes both endings from an explicitly selected author text revision without writing the saved project', async () => {
    const f = await fixture('generate-chapter-draft')
    const content = '# 雨夜车站 {#arrival}\n\n@lin\n别急，我们一起等。\n\n- [留下](stay#ending-stay)\n- [离开](leave#ending-leave)\n'
    const prepared = prepareCreativeCandidateEdit(f.run, { artifactId: f.artifact.id, fingerprint: f.artifact.fingerprint, reason: '作者改为实际人物对白', output: { ...edit, content } }, f.facts)
    const revision = { ...prepared, id: 'author1', fingerprint: 'author1-fp' }
    let run = reduceCreativeTeamRun(f.run, { type: 'edit-candidate', artifact: revision, decisionId: 'edit', reason: '实际对白', requestFingerprint: 'edit' }, 4)
    run = reduceCreativeTeamRun(run, { type: 'select', taskId: 'text', artifactIds: [revision.id], reason: '选择作者修订', decisionId: 'select' }, 5)
    const report = await runCreativePlaytest({ project: f.project, scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }], candidate: { run, artifacts: [{ artifactId: revision.id, fingerprint: revision.fingerprint }] } })
    expect(report.executions.map(item => item.status)).toEqual(['passed', 'passed'])
    expect(report.executions[0]!.trace.some(item => item.text === '别急，我们一起等。')).toBe(true)
    expect(f.files[f.path]).toBe(frozen.files['adv/chapters/station.adv.md'])
    expect(report.snapshotRevision).not.toBe(f.project.revision)
  })
})
