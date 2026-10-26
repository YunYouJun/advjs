import type { CreativeArtifact, CreativeFileChange, CreativeProjectWorkspace } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, CreativeMilestoneReviewService, overlayCreativeChanges } from '../src'
import { creativeArtifact } from './helpers/creative-team'

async function fixture() {
  let files: Record<string, string> = {
    'adv.config.json': JSON.stringify({ schemaVersion: 1, format: 'adv-md', root: 'adv' }),
    'adv/chapters/intro.adv.md': '# 开始 {#start}\n\n雨还在下。\n',
  }
  const snapshot = async () => ({ projectId: 'station', files: { ...files }, revision: await computeAgentProjectRevision(files) })
  const workspace: CreativeProjectWorkspace = {
    snapshot,
    capabilities: ['create-source', 'modify-source', 'delete-source', 'candidate-preview'],
    async commit(changes, expectedRevision) {
      if ((await snapshot()).revision !== expectedRevision)
        throw new Error('conflict')
      files = overlayCreativeChanges(files, changes)
      return snapshot()
    },
  }
  const baseline = await snapshot()
  const artifact: CreativeArtifact = creativeArtifact({
    source: { projectId: 'station', revision: baseline.revision, files: {}, upstream: [] },
    changes: [{ path: 'adv/characters/lin.character.md', before: null, after: '---\nid: lin\nname: 林舟\n---\n谨慎、短句。\n' }],
  })
  return { workspace, artifact, service: new CreativeMilestoneReviewService(workspace), edit: (changes: readonly CreativeFileChange[]) => files = overlayCreativeChanges(files, changes) }
}

describe('creative milestone review with new sources', () => {
  it('previews without touching facts, creates a character, and conditionally undoes the creation', async () => {
    const { workspace, artifact, service } = await fixture()
    const review = await service.review([artifact])
    expect(review.files['adv/characters/lin.character.md']).toContain('林舟')
    expect((await workspace.snapshot()).files['adv/characters/lin.character.md']).toBeUndefined()
    const adopted = await service.apply(review)
    expect(adopted.afterRevision).toBe(review.candidateRevision)
    expect((await workspace.snapshot()).files['adv/characters/lin.character.md']).toContain('林舟')
    const undone = await service.undo(adopted)
    expect(undone.revision).toBe(review.baselineRevision)
    expect(undone.files['adv/characters/lin.character.md']).toBeUndefined()
  })

  it('rejects author edits after review and never overwrites them', async () => {
    const { workspace, artifact, service, edit } = await fixture()
    const review = await service.review([artifact])
    edit([{ path: 'adv/chapters/intro.adv.md', before: '# 开始 {#start}\n\n雨还在下。\n', after: '# 作者修改 {#start}\n\n保留。\n' }])
    await expect(service.apply(review)).rejects.toThrow(/SOURCE_CONFLICT/)
    expect((await workspace.snapshot()).files['adv/chapters/intro.adv.md']).toContain('作者修改')
  })

  it('requires a merge for two agents writing the same file and never leaves a half-applied milestone', async () => {
    const { workspace, artifact, service } = await fixture()
    const conflicting = { ...artifact, id: 'other', changes: [{ ...artifact.changes[0], after: 'different' }] }
    await expect(service.review([artifact, conflicting])).rejects.toThrow(/MERGE_REQUIRED/)
    expect(Object.keys((await workspace.snapshot()).files)).toHaveLength(2)
  })

  it('checks new chapter references and refuses media adoption without a host verifier', async () => {
    const { workspace, artifact, service } = await fixture()
    await expect(service.review([{ ...artifact, kind: 'chapter', changes: [{ path: 'adv/chapters/broken.adv.md', before: null, after: '# 破损 {#start}\n\n- [走](missing#end)' }] }])).rejects.toThrow(/COMPILE_FAILED/)
    await expect(service.review([{ ...artifact, kind: 'art-direction', changes: [{ path: 'adv/assets.json', before: null, after: '{}' }] }])).rejects.toThrow(/REVIEW_UNSUPPORTED:catalog-media/)
    expect(Object.keys((await workspace.snapshot()).files)).toHaveLength(2)
  })

  it('retains the adopted revision if undo would overwrite later author changes', async () => {
    const { artifact, service, edit } = await fixture()
    const commit = await service.apply(await service.review([artifact]))
    edit([{ ...artifact.changes[0], before: artifact.changes[0].after, after: 'author revision' }])
    await expect(service.undo(commit)).rejects.toThrow(/UNDO_CONFLICT/)
  })
})
