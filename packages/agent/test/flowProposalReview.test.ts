// @vitest-environment node
import type { FlowProposalCommand } from '../../core/src/project'
import { describe, expect, it, vi } from 'vitest'
import { flowDocumentRevision, flowProjectRevision } from '../../core/src/project'
import { createFlowProposalReview } from '../src/proposals/flow'
import { AgentProposalReviewService, computeAgentProjectRevision } from '../src/proposals/review'

vi.mock('@advjs/core', () => import('../../core/src/project'))

const path = 'adv/chapters/intro.chapter.json'
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
function files() {
  return {
    'adv.config.json': JSON.stringify({ format: 'flow', root: 'adv' }),
    'adv/settings/game.json': JSON.stringify({ title: 'Story' }),
    [path]: JSON.stringify({ schemaVersion: 1, id: 'intro', title: 'Intro', author: { private: true }, nodes: [
      { id: 'hello', type: 'narration', text: 'Hello', lineId, next: 'end', provenance: { keep: true } },
      { id: 'end', type: 'end' },
    ] }),
  }
}
async function request(source = files(), commands: FlowProposalCommand[] = [{ type: 'update-node', nodeId: 'hello', patch: { text: 'Changed' } }]) {
  return { schemaVersion: 1, path, expectedRevision: await flowDocumentRevision(source[path]!), projectRevision: await flowProjectRevision(source), commands }
}

describe('read-only native Flow review bridge', () => {
  it('reuses existing proposal review with structured allowed patches, no usage and no write API', async () => {
    const source = files()
    const reviewSpy = vi.spyOn(AgentProposalReviewService.prototype, 'review')
    const applySpy = vi.spyOn(AgentProposalReviewService.prototype, 'apply')
    const undoSpy = vi.spyOn(AgentProposalReviewService.prototype, 'undo')
    const result = await createFlowProposalReview({ files: Object.freeze(source), projectId: 'fixture', request: await request(source) })
    expect(result.plan.valid).toBe(true)
    expect(reviewSpy).toHaveBeenCalledTimes(1)
    expect(applySpy).not.toHaveBeenCalled()
    expect(undoSpy).not.toHaveBeenCalled()
    expect(Object.keys(result).sort()).toEqual(['plan', 'review'])
    expect(result.review!.candidate.proposal.patches).toEqual([{ kind: 'json-set', path, key: 'nodes', value: result.plan.proposed.nodes }])
    expect(result.review!.candidate.usage.totalTokens).toBe(0)
    expect(result.review!.baseline.revision).toBe(await computeAgentProjectRevision(source))
    expect(Object.isFrozen(result.review!.baseline.files)).toBe(true)
    expect(JSON.parse(result.review!.files[0]!.after)).toMatchObject({ author: { private: true }, nodes: [
      { id: 'hello', lineId, text: 'Changed', provenance: { keep: true } },
      { id: 'end' },
    ] })
    expect(source).toEqual(files())
    vi.restoreAllMocks()
  })

  it('returns invalid proposed diff and diagnostics without reviewing it as accepted', async () => {
    const source = files()
    const spy = vi.spyOn(AgentProposalReviewService.prototype, 'review')
    const result = await createFlowProposalReview({ files: source, projectId: 'fixture', request: await request(source, [{ type: 'connect', nodeId: 'hello', target: 'missing' }]) })
    expect(result.plan.valid).toBe(false)
    expect(result.plan.changes.nodes).toContainEqual({ nodeId: 'hello', kind: 'updated', fields: ['next'] })
    expect(result.review).toBeUndefined()
    expect(spy).not.toHaveBeenCalled()
    expect(source).toEqual(files())
    vi.restoreAllMocks()
  })

  it('refuses stale dependency snapshots and retains the separate full-map agent revision', async () => {
    const source = files()
    const withIncidentalFile = { ...source, 'README.md': 'Browser-only root documentation' }
    expect(await flowProjectRevision(withIncidentalFile)).toBe(await flowProjectRevision(source))
    expect(await computeAgentProjectRevision(withIncidentalFile)).not.toBe(await computeAgentProjectRevision(source))
    const result = await createFlowProposalReview({ files: withIncidentalFile, projectId: 'fixture', request: await request(source) })
    expect(result.plan.projectRevision).toBe(await flowProjectRevision(source))
    expect(result.review!.baseline.revision).toBe(await computeAgentProjectRevision(withIncidentalFile))
    expect(result.review!.candidate.proposal.projectRevision).toBe(result.review!.baseline.revision)
    const proposal = await request(source)
    source['adv/settings/game.json'] = JSON.stringify({ title: 'Updated elsewhere' })
    await expect(createFlowProposalReview({ files: source, projectId: 'fixture', request: proposal })).rejects.toThrow('ADV_FLOW_SOURCE_CONFLICT')
  })

  it('only generates nodes/title/entry structured patches and retains the planner document', async () => {
    const source = files()
    const result = await createFlowProposalReview({ files: source, projectId: 'fixture', request: await request(source, [{ type: 'set-title', title: 'New title' }, { type: 'set-entry', nodeId: 'end' }]) })
    expect(result.review!.candidate.proposal.patches.map(patch => patch.kind === 'json-set' && patch.key)).toEqual(['title', 'startNodeId'])
    expect(result.plan.proposed).toMatchObject({ id: 'intro', title: 'New title', startNodeId: 'end', author: { private: true } })
  })
})
