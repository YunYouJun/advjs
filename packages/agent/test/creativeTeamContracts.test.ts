import type { CreativeTeamPlan, CreativeTeamRun } from '../src'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { compileProject } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { assertCreativeArtifactBoundary, createCreativeTeamHandoff, CREATIVE_PARTNER_IDS, invalidateCreativeArtifacts, parseCreativeTeamPlan, requiredCreativeReviewCapabilities } from '../src'
import cases from './fixtures/creative-team/v2/cases.json'
import freeze from './fixtures/creative-team/v2/freeze.json'
import manifest from './fixtures/creative-team/v2/manifest.json'
import project from './fixtures/creative-team/v2/project.json'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

describe('creative team public contracts', () => {
  it('keeps all six partner identities separate from the game cast and preserves a short task plan', () => {
    expect(CREATIVE_PARTNER_IDS).toHaveLength(6)
    const plan = creativePlan()
    expect(parseCreativeTeamPlan({ ...plan, tasks: [plan.tasks[0]] }, plan).tasks).toHaveLength(1)
    expect(() => parseCreativeTeamPlan({ ...plan, tasks: [{ ...plan.tasks[0], partner: 'lin' }] }, plan)).toThrow(/Unknown/)
  })

  it.each([
    ['cycle', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [{ ...plan.tasks[0], dependsOn: ['script'] }, plan.tasks[1]] })],
    ['unknown dependency', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [{ ...plan.tasks[0], dependsOn: ['missing'] }] })],
    ['unknown capability', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [{ ...plan.tasks[0], capability: 'execute-code' }] })],
    ['wrong partner authority', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [{ ...plan.tasks[0], capability: 'direct-voice' }] })],
    ['cross project', (plan: CreativeTeamPlan) => ({ ...plan, projectId: 'other' })],
    ['stale revision', (plan: CreativeTeamPlan) => ({ ...plan, projectRevision: 'r0' })],
    ['host code', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [{ ...plan.tasks[0], sourcePaths: ['adv.config.ts'] }] })],
    ['traversal', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [{ ...plan.tasks[0], sourcePaths: ['adv/chapters/../../private.md'] }] })],
    ['unbounded rework', (plan: CreativeTeamPlan) => ({ ...plan, limits: { ...plan.limits, maxReworkRounds: 3 } })],
    ['duplicate id', (plan: CreativeTeamPlan) => ({ ...plan, tasks: [plan.tasks[0], plan.tasks[0]] })],
  ])('rejects %s before dispatch', (_label, mutate) => {
    const plan = creativePlan()
    expect(() => parseCreativeTeamPlan(mutate(plan), plan)).toThrow()
  })

  it('requires explicit creation/media/preview review authority', () => {
    expect(requiredCreativeReviewCapabilities(creativeArtifact())).toEqual(['create-source'])
    expect(requiredCreativeReviewCapabilities({ kind: 'voice-direction', changes: [{ path: 'adv/assets.json', before: '{}', after: '{}' }] })).toEqual(['catalog-media', 'modify-source', 'voice-take'])
    const artifact = creativeArtifact({ reviewCapabilities: [] })
    expect(() => assertCreativeArtifactBoundary(artifact, { id: 'run1', plan: creativePlan(), artifacts: [] })).toThrow(/Missing review/)
  })

  it('rejects cross-project and unselected upstream candidates', () => {
    const cast = creativeArtifact()
    const script = creativeArtifact({ id: 'script1', taskId: 'script', partner: 'writer', kind: 'chapter', changes: [], reviewCapabilities: ['candidate-preview'], source: { ...cast.source, upstream: [{ artifactId: cast.id, fingerprint: cast.fingerprint }] } })
    const run = { id: 'run1', plan: creativePlan(), artifacts: [cast] }
    expect(() => assertCreativeArtifactBoundary(script, run)).not.toThrow()
    expect(() => assertCreativeArtifactBoundary({ ...script, projectId: 'another' }, run)).toThrow(/Cross-project/)
    expect(() => assertCreativeArtifactBoundary(script, { ...run, artifacts: [{ ...cast, status: 'candidate' }] })).toThrow(/upstream/)
  })

  it('invalidates affected descendants and preserves unrelated background work', () => {
    const cast = creativeArtifact()
    const voice = creativeArtifact({ id: 'voice1', kind: 'voice-direction', source: { ...cast.source, files: {}, upstream: [{ artifactId: cast.id, fingerprint: cast.fingerprint }] } })
    const art = creativeArtifact({ id: 'bg', kind: 'art-direction', source: { ...cast.source, files: { 'adv/scenes/station.md': 'station' }, upstream: [] } })
    const next = invalidateCreativeArtifacts([cast, voice, art], { 'adv/world.md': 'edited world', 'adv/scenes/station.md': 'station' })
    expect(next.map(item => [item.id, item.status])).toEqual([['people', 'stale'], ['voice1', 'stale'], ['bg', 'selected']])
  })

  it('hands the independent reviewer original requirements and selected content only', () => {
    const cast = creativeArtifact()
    const run: CreativeTeamRun = {
      id: 'run1',
      accountId: 'account1',
      plan: creativePlan(),
      chargedMicroPoints: 100,
      reservedMicroPoints: 200,
      artifacts: [cast, creativeArtifact({ id: 'self-evaluation', taskId: 'script', kind: 'delivery-summary' })],
      status: 'ready',
      revision: 1,
      tasks: [],
      decisions: [],
      toolCalls: 0,
      createdAt: 0,
      updatedAt: 0,
    }
    const handoff = createCreativeTeamHandoff(run, 'test', { revision: 'r1', files: { 'adv/world.md': 'saved world', 'secret.txt': 'never sent' } })
    expect(handoff.goal).toBe(run.plan.goal)
    expect(handoff.facts.files).toEqual({ 'adv/world.md': 'saved world' })
    expect(handoff.candidates.map(item => item.id)).toEqual(['people'])
    expect(handoff.remainingMicroPoints).toBe(99700)
  })
})

describe('frozen comparison baseline', () => {
  it('starts at the station rather than at an alphabetically earlier ending', async () => {
    const compiled = await compileProject(project)
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.project.program?.entry).toEqual({ chapterId: 'station', nodeId: 'arrival' })
  })
  it('pins all inputs before runtime/prompt work; contains 8 cases per category and 3 independent seeds', async () => {
    for (const [file, expected] of Object.entries(freeze.files)) {
      const bytes = await readFile(new URL(`./fixtures/creative-team/v2/${file}`, import.meta.url))
      expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(expected)
    }
    expect(cases).toHaveLength(24)
    for (const category of ['local', 'chapter', 'short-story'])
      expect(cases.filter(item => item.category === category)).toHaveLength(8)
    expect(new Set(cases.map(item => item.id)).size).toBe(24)
    expect(manifest.seeds).toHaveLength(3)
    expect(manifest.primaryComparison).toEqual(['B', 'C'])
  })
})
