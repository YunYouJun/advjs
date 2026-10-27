import type { CreativeDeliveryRequest, CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import { computeAgentProjectRevision, createCreativeTeamRun } from '@advjs/agent'
import { describe, expect, it, vi } from 'vitest'
import { verifyStudioCreativeDelivery } from '../utils/creativeDelivery'

async function fixture() {
  const files = { 'adv.config.json': '{"schemaVersion":1,"id":"station","root":"adv","format":"adv-md"}', 'adv/chapters/intro.adv.md': '# 等车 {#start}\n\n列车即将抵达。' }
  const project = { id: 'station', revision: await computeAgentProjectRevision(files), files }
  const run: CreativeTeamRun = createCreativeTeamRun({ id: 'delivery', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: project.id, projectRevision: project.revision, goal: '仅审阅此片段', limits: { maxTasks: 1, maxToolCalls: 1, maxReworkRounds: 0, maxMicroPoints: 0 }, tasks: [{ id: 't', partner: 'writer', capability: 'write-chapters', dependsOn: [], sourcePaths: Object.keys(files), instruction: 'Review', expectedOutput: 'Advice' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 't', status: 'completed', attempt: 1, artifactIds: ['a'] }]
  run.artifacts = [{ id: 'a', runId: run.id, taskId: 't', partner: 'writer', projectId: project.id, kind: 'plot-suggestions', source: { projectId: project.id, revision: project.revision, files, upstream: [] }, fingerprint: 'v1', summary: 'Advice', changes: [], reviewCapabilities: [], status: 'selected' }]
  const request: CreativeDeliveryRequest = { project, runRevision: run.revision, reason: 'Close this request only', dispositions: [{ artifactId: 'a', fingerprint: 'v1', disposition: 'reference', reason: 'Retain advice' }], acknowledgeUnverified: true }
  const workspace: CreativeProjectWorkspace = { snapshot: vi.fn(async () => ({ projectId: project.id, revision: project.revision, files })), commit: vi.fn(), capabilities: [] }
  const settled = vi.fn(async () => {})
  return { run, request, workspace, settled }
}

describe('studio author-host delivery verification', () => {
  it('compiles the actual saved project, checks private journals twice and never writes', async () => {
    const h = await fixture()
    await verifyStudioCreativeDelivery(h.workspace, h.run, h.request, h.settled)
    expect(h.settled).toHaveBeenCalledTimes(2)
    expect(h.workspace.snapshot).toHaveBeenCalledTimes(2)
    expect(h.workspace.commit).not.toHaveBeenCalled()
  })
  it('blocks pending local recovery before trusting a project snapshot', async () => {
    const h = await fixture()
    h.settled.mockRejectedValue(new Error('CREATIVE_DELIVERY_LOCAL_PENDING'))
    await expect(verifyStudioCreativeDelivery(h.workspace, h.run, h.request, h.settled)).rejects.toThrow('LOCAL_PENDING')
    expect(h.workspace.snapshot).not.toHaveBeenCalled()
  })
  it('rejects source changes during media verification and propagates real verifier failures', async () => {
    const h = await fixture()
    h.run.artifacts = [{ ...h.run.artifacts[0], status: 'adopted', media: { parent: { artifactId: 'plan', fingerprint: 'v1' }, target: { kind: 'image', assetId: 'portrait' } } as never }]
    h.request.dispositions = [{ ...h.request.dispositions[0], disposition: 'adopted' }]
    h.run.milestones = [{ id: 'adopt', operation: 'adopt', status: 'confirmed', artifacts: [{ artifactId: 'a', fingerprint: 'v1' }], anchors: [], beforeRevision: h.request.project.revision, afterRevision: h.request.project.revision, requestFingerprint: 'receipt', reason: 'Adopt', at: 0 }]
    await expect(verifyStudioCreativeDelivery(h.workspace, h.run, h.request, h.settled)).rejects.toThrow('VERIFIER_REQUIRED')
    h.workspace.verifyMedia = vi.fn(async () => {
      throw new Error('CREATIVE_MEDIA_BYTES_CHANGED')
    })
    await expect(verifyStudioCreativeDelivery(h.workspace, h.run, h.request, h.settled)).rejects.toThrow('BYTES_CHANGED')
    h.workspace.verifyMedia = vi.fn(async () => {
      h.workspace.snapshot = async () => ({ projectId: 'station', revision: 'changed-during-read', files: {} })
    })
    await expect(verifyStudioCreativeDelivery(h.workspace, h.run, h.request, h.settled)).rejects.toThrow('CONFLICT')
  })
  it('rejects an invalid compiled story even when its revision and selected references match', async () => {
    const h = await fixture()
    const files = { ...h.request.project.files, 'adv.config.json': '{invalid' }
    const revision = await computeAgentProjectRevision(files)
    h.request.project = { ...h.request.project, files, revision }
    h.run.artifacts = [{ ...h.run.artifacts[0], source: { ...h.run.artifacts[0].source, files, revision } }]
    h.workspace.snapshot = async () => ({ projectId: 'station', files, revision })
    await expect(verifyStudioCreativeDelivery(h.workspace, h.run, h.request, h.settled)).rejects.toThrow('COMPILE_FAILED')
  })
})
