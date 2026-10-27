import type { CreativeAdoptionJournalEntry, CreativeMilestoneRequest, CreativeTeamClient } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativeTeamRun, creativeMilestoneChanges, CreativeMilestoneCoordinator, invalidateCreativeArtifacts, nextCreativeTeamTask, overlayCreativeMilestone, parseCreativeTeamRun, prepareCreativeMilestone, reduceCreativeTeamRun, reviewCreativeMilestone } from '../src'
import { creativeArtifact, creativePlan } from './helpers/creative-team'

async function fixture() {
  let files: Record<string, string> = { 'adv.config.json': '{"schemaVersion":1,"format":"adv-md","root":"adv"}', 'adv/world.md': 'saved world', 'adv/chapters/intro.adv.md': '# 开始 {#start}\n\n雨还在下。' }
  const snapshot = async () => ({ projectId: 'station', files: { ...files }, revision: await computeAgentProjectRevision(files) })
  const project = { id: 'station', revision: (await snapshot()).revision, files: { ...files } }
  let run = createCreativeTeamRun({ id: 'run1', accountId: 'author1', plan: { ...creativePlan(), projectRevision: project.revision }, now: 0 })
  run.artifacts = [creativeArtifact({ source: { projectId: 'station', revision: project.revision, files: { 'adv/world.md': 'saved world' }, upstream: [] } })]
  run.tasks = run.tasks.map(task => task.taskId === 'cast' ? { ...task, status: 'completed', artifactIds: ['people'] } : task)
  run.status = 'awaiting_review'
  run.chargedMicroPoints = 40
  let journal: CreativeAdoptionJournalEntry | undefined
  let posts = 0
  let writes = 0
  let lose: 'prepare' | 'confirm' | undefined
  let writeThenThrow = false
  let journalFails = false
  let current = true
  let switchAfterPrepare = false
  const unavailable = async (): Promise<never> => {
    throw new Error('Unexpected generation')
  }
  const client: CreativeTeamClient = { availability: unavailable, list: unavailable, start: unavailable, decide: unavailable, refreshFacts: unavailable, editCandidate: unavailable, recordPlaytest: unavailable, getPlaytest: unavailable, get: async () => structuredClone(run), async milestone(_projectId, _runId, command, id) {
    posts += 1
    if (command.type === 'prepare') {
      if (!run.milestones?.some(item => item.id === id)) {
        const prepared = prepareCreativeMilestone(run, command.request)
        const intent = { id, status: 'prepared' as const, operation: command.request.operation, artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: command.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: 'fixture-request', reason: command.request.reason, at: 1, ...(command.request.operation === 'undo' ? { targetId: command.request.milestoneId } : {}) }
        run = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent }, run.updatedAt + 1)
      }
    }
    else {
      const intent = run.milestones!.find(item => item.id === command.milestoneId)!
      if (intent.status === 'prepared') {
        expect(command.project.revision).toBe(command.type === 'confirm' ? intent.afterRevision : intent.beforeRevision)
        run = reduceCreativeTeamRun(run, { type: 'resolve-milestone', milestoneId: intent.id, status: command.type === 'confirm' ? 'confirmed' : 'abandoned', files: command.project.files }, run.updatedAt + 1)
      }
    }
    if (lose === command.type) {
      lose = undefined
      throw new Error('response lost after durable server write')
    }
    if (command.type === 'prepare' && switchAfterPrepare)
      current = false
    return structuredClone(run)
  } }
  const workspace = { snapshot, capabilities: ['create-source', 'modify-source', 'delete-source', 'candidate-preview'] as const, async commit(changes: Parameters<typeof overlayCreativeMilestone>[1], revision: string) {
    if (!current || (await snapshot()).revision !== revision)
      throw new Error('CREATIVE_SOURCE_CONFLICT')
    writes += 1
    files = overlayCreativeMilestone(files, changes)
    if (writeThenThrow)
      throw new Error('host response lost after writing')
    return snapshot()
  } }
  const coordinator = () => new CreativeMilestoneCoordinator({ scope: { accountId: 'author1', projectId: 'station', runId: 'run1' }, client, workspace, journal: { load: async () => structuredClone(journal), save: async (entry) => {
    if (journalFails)
      throw new Error('durable journal unavailable')
    journal = structuredClone(entry)
  } }, assertCurrent() {
    if (!current)
      throw new Error('scope changed')
  } })
  const request: CreativeMilestoneRequest = { operation: 'adopt', project, artifacts: [{ artifactId: 'people', fingerprint: 'people-v1' }], reason: '采用人物初稿' }
  return { coordinator, request, snapshot, getRun: () => run, journal: () => journal, posts: () => posts, writes: () => writes, lose: (phase: typeof lose) => lose = phase, failWriteResponse: () => writeThenThrow = true, failJournal: () => journalFails = true, switchScope: () => current = false, edit: () => files['adv/world.md'] = 'author changes', switchAfterPrepare: () => switchAfterPrepare = true }
}

describe('durable text milestone adoption and recovery', () => {
  it('compiles in isolation, persists before writing, confirms exact source and conditionally undoes without refunding fees', async () => {
    const h = await fixture()
    const review = await reviewCreativeMilestone(h.getRun(), h.request)
    expect((await h.snapshot()).files).not.toHaveProperty('adv/characters/lin.character.md')
    const adopted = await h.coordinator().begin(h.getRun(), h.request, review)
    expect(adopted.artifacts[0].status).toBe('adopted')
    expect(h.journal()?.state).toBe('confirmed')
    expect(invalidateCreativeArtifacts(adopted.artifacts, (await h.snapshot()).files, adopted)[0].status).toBe('adopted')
    expect(parseCreativeTeamRun(adopted, { accountId: 'author1', projectId: 'station' }).milestones).toEqual(adopted.milestones)
    const snapshot = await h.snapshot()
    const undo: CreativeMilestoneRequest = { operation: 'undo', milestoneId: adopted.milestones![0].id, project: { id: 'station', files: snapshot.files, revision: snapshot.revision }, reason: '撤销本次采用' }
    const undone = await h.coordinator().begin(adopted, undo, await reviewCreativeMilestone(adopted, undo))
    expect((await h.snapshot()).revision).toBe(h.request.project.revision)
    expect(undone.artifacts[0].status).toBe('selected')
    expect(undone.chargedMicroPoints).toBe(40)
    expect(undone.decisions.map(item => item.action)).toEqual(['adopt', 'undo'])
  })

  it.each(['prepare', 'confirm'] as const)('recovers an unknown %s response through reads, then an explicit action without another local write', async (phase) => {
    const h = await fixture()
    h.lose(phase)
    await expect(h.coordinator().begin(h.getRun(), h.request, await reviewCreativeMilestone(h.getRun(), h.request))).rejects.toThrow(/response lost/)
    const posts = h.posts()
    const recovered = await h.coordinator().recover()
    expect(h.posts()).toBe(posts)
    expect(recovered?.projectState).toBe(phase === 'prepare' ? 'before' : 'after')
    if (phase === 'prepare')
      expect(nextCreativeTeamTask(h.getRun())).toBeUndefined()
    await h.coordinator().resume(recovered!.entry)
    expect(h.writes()).toBe(1)
    expect(h.getRun().artifacts[0].status).toBe('adopted')
    expect(h.getRun().chargedMicroPoints).toBe(40)
  })

  it('recognizes a host write followed by an exception and only confirms its actual after snapshot', async () => {
    const h = await fixture()
    h.failWriteResponse()
    await expect(h.coordinator().begin(h.getRun(), h.request, await reviewCreativeMilestone(h.getRun(), h.request))).rejects.toThrow(/host response/)
    const recovered = await h.coordinator().recover()
    expect(recovered?.projectState).toBe('after')
    await h.coordinator().resume(recovered!.entry)
    expect(h.writes()).toBe(1)
    expect(h.journal()?.state).toBe('confirmed')
  })

  it('preserves divergent author files and a durable unresolved intent instead of overwriting on reconnect', async () => {
    const h = await fixture()
    h.lose('prepare')
    await expect(h.coordinator().begin(h.getRun(), h.request, await reviewCreativeMilestone(h.getRun(), h.request))).rejects.toThrow()
    h.edit()
    const recovered = await h.coordinator().recover()
    expect(recovered?.projectState).toBe('conflict')
    await expect(h.coordinator().resume(recovered!.entry)).rejects.toThrow(/SOURCE_CONFLICT/)
    await expect(h.coordinator().abandon(recovered!.entry)).rejects.toThrow(/SOURCE_CONFLICT/)
    expect(h.writes()).toBe(0)
    expect(h.journal()?.state).toBe('preparing')
  })

  it('aborts before any POST or source write when durable storage fails', async () => {
    const h = await fixture()
    h.failJournal()
    await expect(h.coordinator().begin(h.getRun(), h.request, await reviewCreativeMilestone(h.getRun(), h.request))).rejects.toThrow(/journal unavailable/)
    expect(h.posts()).toBe(0)
    expect(h.writes()).toBe(0)
  })

  it('keeps the journal but never writes through an old handle after the scope changes during preparation', async () => {
    const h = await fixture()
    h.switchAfterPrepare()
    await expect(h.coordinator().begin(h.getRun(), h.request, await reviewCreativeMilestone(h.getRun(), h.request))).rejects.toThrow('scope changed')
    expect(h.getRun().milestones![0].status).toBe('prepared')
    expect(h.journal()?.state).toBe('preparing')
    expect(h.writes()).toBe(0)
  })

  it('allows an authoring review to restore a valid empty asset catalog while retaining other compiler diagnostics', async () => {
    const h = await fixture()
    const files = { ...h.request.project.files, 'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'station', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, includes: ['assets/other.json'] }), 'adv/assets/other.json': '{"schemaVersion":2,"assets":[]}' }
    const request = { ...h.request, project: { ...h.request.project, files, revision: await computeAgentProjectRevision(files) } }
    const reviewed = await reviewCreativeMilestone(h.getRun(), request)
    expect(reviewed.files['adv/assets/other.json']).toBe(files['adv/assets/other.json'])
    expect(reviewed.diagnostics.some(item => item.severity === 'error')).toBe(false)
    const broken = { ...files, 'adv/chapters/intro.adv.md': '# 开始 {#start}\n\n- [Missing](missing#end)' }
    await expect(reviewCreativeMilestone(h.getRun(), { ...request, project: { ...request.project, files: broken, revision: await computeAgentProjectRevision(broken) } })).rejects.toThrow('COMPILE_FAILED')
  })

  it('rejects a write whose after snapshot cannot fit the confirmation protocol', async () => {
    const h = await fixture()
    h.getRun().artifacts[0].changes = [{ path: 'adv/characters/lin.character.md', before: null, after: `---\nid: lin\nname: 林舟\n---\n${'长'.repeat(49000)}` }]
    await expect(reviewCreativeMilestone(h.getRun(), h.request)).rejects.toThrow()
    expect(h.posts()).toBe(0)
    expect(h.writes()).toBe(0)
  })

  it('can abandon an unapplied intent and rejects late actions after an account or project switch', async () => {
    const h = await fixture()
    h.lose('prepare')
    await expect(h.coordinator().begin(h.getRun(), h.request, await reviewCreativeMilestone(h.getRun(), h.request))).rejects.toThrow()
    const recovered = await h.coordinator().recover()
    const abandoned = await h.coordinator().abandon(recovered!.entry)
    expect(abandoned.milestones![0].status).toBe('abandoned')
    expect(h.writes()).toBe(0)
    h.switchScope()
    await expect(h.coordinator().resume(recovered!.entry)).rejects.toThrow(/scope changed/)
  })

  it('anchors compatible descendants while invalidating unrelated candidates that read a changed source', async () => {
    const h = await fixture()
    const run = h.getRun()
    const parent = run.artifacts[0]
    const modified = { ...parent, changes: [{ path: 'adv/world.md', before: 'saved world', after: 'new world' }] }
    run.artifacts = [modified, { ...parent, id: 'dependent', taskId: 'script', partner: 'writer', kind: 'chapter', changes: [], source: { ...parent.source, upstream: [{ artifactId: parent.id, fingerprint: parent.fingerprint }] } }, { ...parent, id: 'independent', taskId: 'test', partner: 'playtester', kind: 'playtest-plan', changes: [] }]
    const prepared = prepareCreativeMilestone(run, h.request)
    const intent = { id: 'anchor-test', operation: 'adopt' as const, status: 'prepared' as const, artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: h.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: 'local-test', reason: 'anchor test', at: 1 }
    const adopted = reduceCreativeTeamRun(reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent }, 1), { type: 'resolve-milestone', milestoneId: intent.id, status: 'confirmed', files: prepared.files }, 2)
    expect(adopted.artifacts.map(item => item.status)).toEqual(['adopted', 'selected', 'stale'])
    const undoChanges = creativeMilestoneChanges(adopted, { operation: 'undo', artifacts: [], targetId: intent.id })
    expect(overlayCreativeMilestone(prepared.files, undoChanges)).toEqual(h.request.project.files)
  })

  it('requires selected upstream writes, explicit resolution of overlapping files and a real media verifier', async () => {
    const h = await fixture()
    const run = h.getRun()
    const cast = run.artifacts[0]
    const chapter = { ...cast, id: 'chapter', fingerprint: 'chapter-fp', taskId: 'script', partner: 'writer' as const, kind: 'chapter' as const, source: { ...cast.source, upstream: [{ artifactId: cast.id, fingerprint: cast.fingerprint }] }, changes: [{ path: 'adv/chapters/new.adv.md', before: null, after: '# 新章 {#start}' }] }
    run.artifacts = [cast, chapter]
    const onlyChild: CreativeMilestoneRequest = { ...h.request, operation: 'adopt', artifacts: [{ artifactId: chapter.id, fingerprint: chapter.fingerprint }] }
    expect(() => prepareCreativeMilestone(run, onlyChild)).toThrow('CREATIVE_MILESTONE_UPSTREAM_REQUIRED')
    const together: CreativeMilestoneRequest = { ...onlyChild, artifacts: [...(h.request.operation === 'adopt' ? h.request.artifacts : []), ...onlyChild.artifacts] }
    expect(prepareCreativeMilestone(run, together).changes).toHaveLength(2)
    chapter.changes = cast.changes.map(change => ({ ...change, after: `${change.after}\nDifferent contribution` })) as typeof chapter.changes
    expect(() => prepareCreativeMilestone(run, together)).toThrow(/MERGE_REQUIRED/)
    cast.kind = 'art-direction'
    cast.partner = 'art-director'
    cast.changes = [{ path: 'adv/assets.json', before: null, after: '{}' }]
    expect(() => prepareCreativeMilestone(run, h.request)).toThrow('CREATIVE_MEDIA_VERIFIER_REQUIRED')
  })

  it('retains approved plan ancestors across their own descendant adoption without anchoring unrelated branches', async () => {
    const h = await fixture()
    const run = h.getRun()
    const cast = run.artifacts[0]
    const plan = { ...cast, id: 'director-plan', fingerprint: 'director-fp', taskId: 'director', partner: 'director' as const, kind: 'production-brief' as const, changes: [] }
    cast.source = { ...cast.source, upstream: [{ artifactId: plan.id, fingerprint: plan.fingerprint }] }
    cast.changes = [{ path: 'adv/world.md', before: 'saved world', after: 'adopted world' }]
    const independent = { ...plan, id: 'art', taskId: 'art', partner: 'art-director' as const, kind: 'art-direction' as const, source: { ...plan.source, upstream: [{ artifactId: plan.id, fingerprint: plan.fingerprint }] } }
    run.artifacts = [plan, cast, independent]
    const prepared = prepareCreativeMilestone(run, h.request)
    const intent = { id: 'lineage', operation: 'adopt' as const, status: 'prepared' as const, artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: h.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: 'test', reason: 'adopt', at: 1 }
    const adopted = reduceCreativeTeamRun(reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent }, 1), { type: 'resolve-milestone', milestoneId: intent.id, status: 'confirmed', files: prepared.files }, 2)
    expect(adopted.artifacts.map(item => item.status)).toEqual(['selected', 'adopted', 'stale'])
  })
})
