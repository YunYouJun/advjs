import type { CreativeCandidateEditRequest, CreativeEditableOutput, CreativeTeamAction, CreativeTeamRun } from '../src'
import { describe, expect, it } from 'vitest'
import { createCreativeTeamRun, creativeOutputFileChanges, parseCreativeCandidateEditRequest, parseCreativeTeamRun, prepareCreativeCandidateEdit, reduceCreativeTeamRun } from '../src'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

const files = { 'adv/world.md': 'saved world' }
const output: Extract<CreativeEditableOutput, { kind: 'characters' }> = { kind: 'characters', summary: '林舟人物档案', characters: [{ id: 'lin', name: '林舟', description: '职员', motivation: '归还信', speakingStyle: '短句', visualConstraints: ['制服'], voiceConstraints: ['低声'], relationships: [] }] }
const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30, providerCostMicroCny: 20, chargedMicroPoints: 40 }
function act(run: CreativeTeamRun, action: CreativeTeamAction) {
  return reduceCreativeTeamRun(run, action, run.updatedAt + 1)
}
function fixture() {
  let run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: creativePlan(), now: 0 })
  run = act(run, { type: 'approve-plan', decisionId: 'approve' })
  run = act(run, { type: 'reserve-next', taskId: 'cast', quotedMicroPoints: 100, toolCalls: 1, inputFingerprint: 'source1' })
  run = act(run, { type: 'settle-task', taskId: 'cast', dispatchKey: 'run1:cast:1', status: 'completed', usage, artifacts: [creativeArtifact({ status: 'candidate', output, changes: creativeOutputFileChanges(output, files) })] })
  return act(run, { type: 'select', taskId: 'cast', artifactIds: ['people'], decisionId: 'select', reason: 'Use this cast' })
}
function request(): CreativeCandidateEditRequest {
  return { artifactId: 'people', fingerprint: 'people-v1', reason: '把人物动机改得更明确', output: { ...output, characters: output.characters.map(character => ({ ...character, motivation: '找到信的主人，再决定是否交还' })) } }
}

describe('immutable author candidate revisions', () => {
  it('retains the paid original, records the author decision and waits for review without changing saved files', () => {
    const original = fixture()
    const prepared = prepareCreativeCandidateEdit(original, request(), { revision: 'r1', files })
    const edited = { ...prepared, id: 'author-revision1', fingerprint: 'author-fingerprint1' }
    const action: CreativeTeamAction = { type: 'edit-candidate', artifact: edited, decisionId: 'edit1', reason: request().reason, requestFingerprint: 'intent1' }
    const run = act(original, action)
    expect(original.artifacts[0].status).toBe('selected')
    expect(run.artifacts[0].status).toBe('stale')
    expect(run.artifacts[1].changes[0].after).toContain('找到信的主人')
    expect(run.tasks[0]).toMatchObject({ status: 'awaiting_review', artifactIds: [edited.id], history: original.tasks[0].history })
    expect(run.chargedMicroPoints).toBe(original.chargedMicroPoints)
    expect(run.toolCalls).toBe(original.toolCalls)
    expect(files).not.toHaveProperty('adv/characters/lin.character.md')
    expect(run.decisions.at(-1)).toMatchObject({ action: 'edit', artifactIds: [edited.id], reason: request().reason, requestFingerprint: 'intent1' })
    expect(act(run, action)).toBe(run)
    expect(parseCreativeTeamRun(run, { accountId: 'author1', projectId: 'station' }).artifacts[1].editedFrom).toEqual({ artifactId: 'people', fingerprint: 'people-v1' })
  })

  it('keeps an in-flight child and its charge, then marks the returned old-context result stale', () => {
    let run = act(fixture(), { type: 'reserve-next', taskId: 'script', quotedMicroPoints: 100, toolCalls: 1, inputFingerprint: 'uses-people-v1' })
    const prepared = prepareCreativeCandidateEdit(run, request(), { revision: 'r1', files })
    run = act(run, { type: 'edit-candidate', artifact: { ...prepared, id: 'author1', fingerprint: 'people-v2' }, decisionId: 'edit', reason: '调整动机', requestFingerprint: 'intent' })
    expect(run.tasks[1].status).toBe('running')
    expect(run.reservedMicroPoints).toBe(100)
    const chapter = creativeArtifact({ id: 'chapter', kind: 'chapter', partner: 'writer', taskId: 'script', source: { projectId: 'station', revision: 'r1', files, upstream: [{ artifactId: 'people', fingerprint: 'people-v1' }] }, changes: [], reviewCapabilities: ['candidate-preview'], status: 'candidate' })
    run = act(run, { type: 'settle-task', taskId: 'script', dispatchKey: 'run1:script:1', status: 'completed', usage, artifacts: [chapter] })
    expect(run.tasks[1].status).toBe('stale')
    expect(run.artifacts.find(artifact => artifact.id === 'chapter')?.status).toBe('stale')
    expect(run.tasks[1].history?.[0].usage).toEqual(usage)
    expect(run.chargedMicroPoints).toBe(80)
    expect(run.reservedMicroPoints).toBe(0)
  })

  it('does not silently rebase a changed write target or accept client provenance', () => {
    expect(() => prepareCreativeCandidateEdit(fixture(), request(), { revision: 'r2', files: { ...files, 'adv/characters/lin.character.md': '作者刚写的人物' } })).toThrow('SOURCE_CONFLICT')
    expect(() => parseCreativeCandidateEditRequest({ ...request(), source: { revision: 'forged' } })).toThrow()
    expect(() => prepareCreativeCandidateEdit(fixture(), { ...request(), fingerprint: 'wrong' }, { revision: 'r1', files })).toThrow('SOURCE_CONFLICT')
    expect(() => prepareCreativeCandidateEdit(fixture(), { ...request(), output: { kind: 'playtest-report', passed: true } }, { revision: 'r1', files })).toThrow()
  })
})
