import type { CreativeArtifact, CreativeMilestoneIntent, CreativeMilestoneRequest } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativeTeamRun, creativeMergeInvalidations, creativeMilestoneChanges, creativeMilestoneConflicts, mergeCreativeMilestoneChanges, overlayCreativeMilestone, parseCreativeMilestoneRequest, parseCreativeTeamRun, prepareCreativeMilestone, reduceCreativeTeamRun, reviewCreativeMilestone } from '../src'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

const path = 'adv/chapters/intro.adv.md'
async function fixture() {
  const files = { 'adv.config.json': '{"schemaVersion":1,"format":"adv-md","root":"adv"}', [path]: '# 等车 {#start}\n\n旧对白。\n' }
  const project = { id: 'station', files, revision: await computeAgentProjectRevision(files) }
  const run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: { ...creativePlan(), projectRevision: project.revision }, now: 0 })
  const make = (id: string, after: string): CreativeArtifact => creativeArtifact({ id, fingerprint: `${id}-v1`, taskId: 'script', partner: 'writer', kind: 'chapter', summary: id, source: { projectId: project.id, revision: project.revision, files, upstream: [] }, changes: [{ path, before: files[path], after }], reviewCapabilities: ['modify-source', 'candidate-preview'] })
  run.artifacts = [make('a', '# 等车 {#start}\n\n等到末班车。\n'), make('b', '# 等车 {#start}\n\n先归还信件。\n')]
  run.status = 'awaiting_review'
  run.tasks = run.tasks.map(item => ({ ...item, status: 'completed', artifactIds: item.taskId === 'script' ? ['a', 'b'] : [] }))
  const request: Extract<CreativeMilestoneRequest, { operation: 'adopt' }> = { operation: 'adopt', artifacts: run.artifacts.map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })), project, reason: '综合候选的行动与动机', merges: [{ path, after: '# 等车 {#start}\n\n先归还信件，再等末班车。\n' }] }
  return { run, request, project }
}

describe('explicit author milestone merges', () => {
  it('requires every conflict, coalesces only byte-identical changes and refuses unselected paths or extra authority', async () => {
    const { run, request } = await fixture()
    expect(creativeMilestoneConflicts(run.artifacts)[0]).toMatchObject({ path, editable: true, contributions: [{ artifactId: 'a' }, { artifactId: 'b' }] })
    expect(() => prepareCreativeMilestone(run, { ...request, merges: undefined })).toThrow('CREATIVE_MERGE_REQUIRED')
    expect(() => prepareCreativeMilestone(run, { ...request, merges: [{ path: 'adv/world.md', after: 'injected' }] })).toThrow('CREATIVE_MERGE_INVALID')
    expect(() => parseCreativeMilestoneRequest({ ...request, merges: [{ ...request.merges![0], before: 'forged' }] })).toThrow()
    expect(() => parseCreativeMilestoneRequest({ ...request, merges: [...request.merges!, ...request.merges!] })).toThrow()
    expect(() => parseCreativeMilestoneRequest({ ...request, merges: [{ path, after: '汉'.repeat(17000) }] })).toThrow()
    const same = structuredClone(run.artifacts)
    same[1]!.changes = structuredClone(same[0]!.changes)
    expect(mergeCreativeMilestoneChanges(same)).toEqual(same[0]!.changes)
    expect(() => mergeCreativeMilestoneChanges(same, request.merges)).toThrow('CREATIVE_MERGE_INVALID')
  })

  it('compiles the author result, retains immutable inputs and reconstructs exact conditional undo after decoding a receipt', async () => {
    const { run, request, project } = await fixture()
    const original = structuredClone(run.artifacts)
    const review = await reviewCreativeMilestone(run, request)
    expect(review.changes).toEqual([{ path, before: project.files[path], after: request.merges![0]!.after }])
    expect(run.artifacts).toEqual(original)
    expect(project.files[path]).toContain('旧对白')
    const prepared = prepareCreativeMilestone(run, request)
    const intent: CreativeMilestoneIntent = { id: 'merge1', operation: 'adopt', status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, merges: request.merges, beforeRevision: project.revision, afterRevision: review.candidateRevision, requestFingerprint: 'fixture', reason: request.reason, at: 1 }
    let result = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent }, 1)
    result = reduceCreativeTeamRun(result, { type: 'resolve-milestone', milestoneId: intent.id, status: 'confirmed', files: review.files }, 2)
    result = parseCreativeTeamRun(JSON.parse(JSON.stringify(result)), { accountId: run.accountId, projectId: project.id })
    expect(result.artifacts.map(item => item.status)).toEqual(['adopted', 'adopted'])
    expect(result.decisions.at(-1)).toMatchObject({ action: 'adopt', artifactIds: ['a', 'b'], reason: request.reason })
    expect(result.milestones![0]!.merges).toEqual(request.merges)
    expect(overlayCreativeMilestone(review.files, creativeMilestoneChanges(result, { operation: 'undo', artifacts: [], targetId: intent.id }))).toEqual(project.files)
    const edited = { ...project, files: { ...review.files, [path]: 'later author change' }, revision: 'later' }
    expect(() => prepareCreativeMilestone(result, { operation: 'undo', project: edited, milestoneId: intent.id, reason: 'restore' })).toThrow('CREATIVE_UNDO_CONFLICT')
    expect(result.chargedMicroPoints).toBe(run.chargedMicroPoints)
    expect(result.toolCalls).toBe(0)
  })

  it('expires dependent outputs even with no copied source, while preserving independent assets', async () => {
    const { run, request } = await fixture()
    const source = { ...run.artifacts[0]!.source, files: {}, upstream: [{ artifactId: 'a', fingerprint: 'a-v1' }] }
    const child = creativeArtifact({ id: 'child', taskId: 'voice', partner: 'voice-director', kind: 'voice-direction', changes: [], reviewCapabilities: ['voice-take'], source })
    const independent = creativeArtifact({ id: 'independent', changes: [], source: { ...source, upstream: [], files: {} } })
    run.artifacts = [...run.artifacts, child, independent]
    const prepared = prepareCreativeMilestone(run, request)
    expect(prepared.anchors).not.toContain(child.id)
    const intent: CreativeMilestoneIntent = { id: 'merge', operation: 'adopt', status: 'prepared', ...prepared, merges: request.merges, beforeRevision: request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: 'fixture', reason: request.reason, at: 1 }
    let after = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent }, 1)
    after = reduceCreativeTeamRun(after, { type: 'resolve-milestone', milestoneId: intent.id, status: 'confirmed', files: prepared.files }, 2)
    expect(after.artifacts.find(item => item.id === 'child')!.status).toBe('stale')
    expect(after.artifacts.find(item => item.id === 'independent')!.status).toBe('selected')
    const reviewChild = { ...child, kind: 'playtest-report' as const, partner: 'playtester' as const, taskId: 'test', reviewCapabilities: ['candidate-preview' as const] }
    const withReview = { ...run, artifacts: run.artifacts.map(item => item.id === child.id ? reviewChild : item) }
    expect(() => prepareCreativeMilestone(withReview, { ...request, artifacts: [...request.artifacts, { artifactId: child.id, fingerprint: child.fingerprint }] })).toThrow('CREATIVE_MILESTONE_REBASE_REQUIRED')
  })

  it('retains descendants built from an unchanged winning version but expires the other lineage', async () => {
    const { run, request } = await fixture()
    const child = (parent: string) => creativeArtifact({ id: `child-${parent}`, changes: [], source: { ...run.artifacts[0]!.source, upstream: [{ artifactId: parent, fingerprint: `${parent}-v1` }] } })
    run.artifacts = [...run.artifacts, child('a'), child('b')]
    const stale = creativeMergeInvalidations(run, request.artifacts, [{ path, after: run.artifacts[1]!.changes[0]!.after }])
    expect([...stale]).toEqual(['child-a'])
  })

  it('rejects changed sources, unsupported media merges, mixed baselines and invalid compiled results', async () => {
    const { run, request } = await fixture()
    await expect(reviewCreativeMilestone(run, { ...request, merges: [{ path, after: '# 破损 {#start}\n\n- [离开](missing#end)' }] })).rejects.toThrow('CREATIVE_COMPILE_FAILED')
    expect(() => prepareCreativeMilestone(run, { ...request, project: { ...request.project, files: { ...request.project.files, [path]: '作者新修改' } } })).toThrow('CREATIVE_SOURCE_CONFLICT')
    const mixed = structuredClone(run.artifacts)
    mixed[1]!.changes = [{ ...mixed[1]!.changes[0]!, before: 'different base' }]
    expect(creativeMilestoneConflicts(mixed)[0]!.editable).toBe(false)
    expect(() => mergeCreativeMilestoneChanges(mixed, request.merges)).toThrow()
    expect(() => parseCreativeMilestoneRequest({ ...request, merges: [{ path: 'adv/assets.json', after: '{}' }] })).toThrow()
    expect(() => mergeCreativeMilestoneChanges([{ ...run.artifacts[0]!, kind: 'voice-direction' }, run.artifacts[1]!], request.merges)).toThrow()
  })

  it('lets authors reconcile character prose without altering stable identity, opaque metadata or voice authority', () => {
    const path = 'adv/characters/lin.character.md'
    const before = '---\nid: lin\nname: 林\nvoiceProfile:\n  locales:\n    zh-CN:\n      providers:\n        original: { voiceId: issued, model: existing, source: system }\ncustom: { keep: true }\n---\n旧正文'
    const a = creativeArtifact({ changes: [{ path, before, after: before.replace('旧正文', '谨慎') }] })
    const b = { ...a, id: 'b', changes: [{ path, before, after: before.replace('旧正文', '主动') }] }
    const after = before.replace('旧正文', '谨慎但主动')
    expect(mergeCreativeMilestoneChanges([a, b], [{ path, after }])).toEqual([{ path, before, after }])
    for (const unsafe of [after.replace('issued', 'forged'), after.replace('id: lin', 'id: other'), after.replace('keep: true', 'keep: false')])
      expect(() => mergeCreativeMilestoneChanges([a, b], [{ path, after: unsafe }])).toThrow('CREATIVE_MERGE_CHARACTER_METADATA')
    expect(mergeCreativeMilestoneChanges([a, b], [{ path, after: null }])).toEqual([{ path, before, after: null }])
  })
})
