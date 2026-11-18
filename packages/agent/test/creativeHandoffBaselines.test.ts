import type { CreativeArtifact } from '../src/creative-team/contracts'
import { describe, expect, it } from 'vitest'
import { createCreativeTeamHandoff } from '../src/creative-team/candidates'
import { createCreativeTeamRun } from '../src/creative-team/orchestration'
import { overlayCreativeChanges } from '../src/creative-team/review'

const game = 'adv/settings/game.json'
const before = '{"entryChapterId":"station"}\n'
const after = '{\n  "entryChapterId": "station"\n}\n'
function fixture() {
  const run = createCreativeTeamRun({ id: 'crew-baseline', accountId: 'benchmark-fixture', now: 0, plan: { protocolVersion: 1, projectId: 'station', projectRevision: 'r1', goal: 'voice after selected writing', limits: { maxTasks: 4, maxToolCalls: 8, maxReworkRounds: 2, maxMicroPoints: 100 }, tasks: [{ id: 'writer', partner: 'writer', capability: 'write-chapters', dependsOn: [], sourcePaths: ['adv/world.md'], instruction: 'write', expectedOutput: 'chapters' }, { id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: ['writer'], sourcePaths: ['adv/world.md'], instruction: 'voice plan', expectedOutput: 'voice direction' }] } })
  const artifact: CreativeArtifact = { id: 'writer-one', runId: run.id, taskId: 'writer', partner: 'writer', projectId: 'station', kind: 'chapter', summary: 'selected writing', fingerprint: 'selected-writing-one', status: 'selected', source: { projectId: 'station', revision: 'r1', files: { [game]: before }, upstream: [] }, changes: [{ path: game, before, after }], reviewCapabilities: ['modify-source', 'candidate-preview'] }
  run.artifacts = [artifact]
  return run
}
const facts = { revision: 'r1', files: { 'adv/world.md': '当代车站', [game]: before, 'adv/outline.md': 'unrelated source stays outside the handoff' } }

describe('saved baselines required by selected upstream changes', () => {
  it('adds only actual required baselines to a narrower role handoff so upstream writes can be materialized', () => {
    const run = fixture()
    const handoff = createCreativeTeamHandoff(run, 'voice', facts)
    expect(handoff.facts.files).toEqual({ 'adv/world.md': facts.files['adv/world.md'], [game]: before })
    expect(overlayCreativeChanges(handoff.facts.files, handoff.candidates[0].changes)[game]).toBe(after)
    expect(handoff.facts.files).not.toHaveProperty('adv/outline.md')
    expect(facts.files[game]).toBe(before)
  })

  it('uses current saved facts and preserves conflict refusal rather than manufacturing a stale candidate baseline', () => {
    const run = fixture()
    const handoff = createCreativeTeamHandoff(run, 'voice', { revision: 'r2', files: { ...facts.files, [game]: 'author changed this file' } })
    expect(handoff.facts.files[game]).toBe('author changed this file')
    expect(() => overlayCreativeChanges(handoff.facts.files, handoff.candidates[0].changes)).toThrow('CREATIVE_SOURCE_CONFLICT')
    const missing = createCreativeTeamHandoff(run, 'voice', { revision: 'r3', files: { 'adv/world.md': '当代车站' } })
    expect(missing.facts.files).not.toHaveProperty(game)
    expect(() => overlayCreativeChanges(missing.facts.files, missing.candidates[0].changes)).toThrow('CREATIVE_SOURCE_CONFLICT')
  })
})
