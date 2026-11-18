import type { CreativeAdoptionJournalEntry, CreativeMediaCandidateRequest, CreativeTeamClient, CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportEntry } from '../utils/creativeArtImportCache'
import type { CreativeMilestoneMediaCache } from '../utils/creativeMediaMilestoneCache'
import type { IFileSystem } from '../utils/fs'
import { Buffer, Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computeAgentProjectRevision, createCreativeTeamRun, creativeMediaCanonical, CreativeMilestoneCoordinator, prepareCreativeMediaCandidate, prepareCreativeMilestone, reduceCreativeTeamRun, reviewCreativeMilestone } from '@advjs/agent'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { submitCreativeMediaCandidate } from '../utils/creativeMediaCandidate'
import { createStudioCreativeMediaWorkspace } from '../utils/creativeMediaMilestoneWorkspace'
import { reviewCreativeVoiceSelection } from '../utils/creativeVoiceImport'
import { commitStudioProjectFiles } from '../utils/nativeProjectMutation'

const root = existsSync(resolve('pnpm-workspace.yaml')) ? process.cwd() : resolve('../..')
const captured = JSON.parse(readFileSync(resolve(root, 'packages/agent/test/fixtures/creative-media-author-host.json'), 'utf8'))
const golden = captured.image
const image = readFileSync(resolve(root, 'demo/starter/public/img/characters/xiaoyun.webp'))
const fingerprint = (value: unknown) => createHash('sha256').update(creativeMediaCanonical(value)).digest('hex')
beforeAll(() => {
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('File', NodeFile)
  vi.stubGlobal('crypto', webcrypto)
})
afterAll(() => vi.unstubAllGlobals())
async function fixture() {
  const files = structuredClone(golden.before) as Record<string, string>
  const before = structuredClone(files)
  const blobs = new Map<string, Blob>()
  const fs = {
    exists: async (path: string) => path in files || blobs.has(path),
    readFile: async (path: string) => files[path],
    readBlob: async (path: string) => {
      const blob = blobs.get(path)
      if (!blob)
        throw new Error('missing binary')
      return blob
    },
    collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) })),
    writeFile: vi.fn(async (path: string, content: string) => { files[path] = content }),
    writeBlob: vi.fn(async (path: string, blob: Blob) => { blobs.set(path, blob) }),
    deleteFile: vi.fn(async (path: string) => {
      delete files[path]
      blobs.delete(path)
    }),
    flush: vi.fn(async () => {}),
  } as unknown as IFileSystem
  const revision = await computeAgentProjectRevision(files)
  const scope = { accountId: 'author', projectId: golden.id, runId: 'media-run' }
  let run: CreativeTeamRun = createCreativeTeamRun({ id: scope.runId, accountId: scope.accountId, now: 0, plan: { protocolVersion: 1, projectId: scope.projectId, projectRevision: revision, goal: 'Host media milestone protocol unit fixture', limits: { maxTasks: 4, maxToolCalls: 4, maxReworkRounds: 2, maxMicroPoints: 0 }, tasks: [{ id: 'art', partner: 'art-director', capability: 'direct-art', dependsOn: [], sourcePaths: Object.keys(files), instruction: 'Real image metadata', expectedOutput: 'Catalog binding' }] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'art', status: 'completed', attempt: 1, artifactIds: ['direction'] }]
  const request = { assetId: golden.assetId, kind: 'portrait' as const, characterId: 'xiaoyun', width: 619, height: 619, prompt: 'Original repository image', constraints: [] }
  run.artifacts = [{ id: 'direction', runId: run.id, taskId: 'art', partner: 'art-director', projectId: scope.projectId, kind: 'art-direction', source: { projectId: scope.projectId, revision, files: before, upstream: [] }, fingerprint: 'direction-v1', summary: 'Explicit direction fixture', output: { kind: 'art-direction', summary: 'Explicit fixture', style: 'Unmodified image', requests: [request] }, changes: [], reviewCapabilities: [], status: 'selected' }]
  const data = image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer
  const media = JSON.parse(golden.after['adv/assets/other.json']).assets[0]
  let entry: CreativeArtImportEntry = { ...scope, id: 'local-image', artifactId: 'direction', artifactFingerprint: 'direction-v1', request, fileName: 'xiaoyun.webp', attribution: 'Existing repository image', license: '', createdAt: 0, image: { sha256: media.sha256, bytes: media.bytes, width: 619, height: 619, mimeType: 'image/webp' }, data, state: 'candidate', review: { beforeRevision: revision, afterRevision: await computeAgentProjectRevision(golden.after), mediaPath: `adv/assets/${media.path}`, binding: 'character:xiaoyun:default', changes: Object.entries(golden.writes as Record<string, string>).map(([path, content]) => ({ path, expected: before[path] ?? null, content })) } }
  let journal: CreativeAdoptionJournalEntry | undefined
  let lost: 'register' | 'prepare' | 'confirm' | undefined
  let posts = 0
  const unavailable = async (): Promise<never> => {
    throw new Error('No model task is allowed')
  }
  async function submit(input: CreativeMediaCandidateRequest, intent: string) {
    posts++
    if (!run.decisions.some(item => item.id === intent)) {
      const prepared = prepareCreativeMediaCandidate(run, input, fingerprint)
      run = reduceCreativeTeamRun(run, { type: 'register-media', artifact: { ...prepared, id: 'media-one', fingerprint: fingerprint(prepared) }, decisionId: intent, reason: input.reason, requestFingerprint: fingerprint(input) }, 1)
    }
    if (lost === 'register') {
      lost = undefined
      throw new Error('registration response lost')
    }
    return structuredClone(run)
  }
  const client: CreativeTeamClient = { availability: unavailable, list: unavailable, start: unavailable, decide: unavailable, editCandidate: unavailable, refreshFacts: unavailable, recordPlaytest: unavailable, getPlaytest: unavailable, get: async () => structuredClone(run), async milestone(_project, _run, command, intentId) {
    posts++
    if (command.type === 'prepare' && !run.milestones?.some(item => item.id === intentId)) {
      const prepared = prepareCreativeMilestone(run, command.request)
      run = reduceCreativeTeamRun(run, { type: 'prepare-milestone', intent: { id: intentId, operation: command.request.operation, status: 'prepared', artifacts: prepared.artifacts, anchors: prepared.anchors, beforeRevision: command.request.project.revision, afterRevision: await computeAgentProjectRevision(prepared.files), requestFingerprint: fingerprint(command.request), reason: command.request.reason, at: 2, ...(command.request.operation === 'undo' ? { targetId: command.request.milestoneId } : {}) } }, 2)
    }
    else if (command.type !== 'prepare') {
      const intent = run.milestones!.find(item => item.id === command.milestoneId)!
      if (intent.status === 'prepared')
        run = reduceCreativeTeamRun(run, { type: 'resolve-milestone', milestoneId: intent.id, status: command.type === 'confirm' ? 'confirmed' : 'abandoned', files: command.project.files }, 3)
    }
    if (lost === command.type) {
      lost = undefined
      throw new Error('milestone response lost')
    }
    return structuredClone(run)
  } }
  // Private storage is an explicit unit substitute. Browser tests cover the real IndexedDB group claim/receipt.
  const cache: CreativeMilestoneMediaCache = { list: async () => [{ kind: 'image', entry }], claim: vi.fn(async (_scope, _run, intent) => {
    entry = { ...entry, managed: { ...entry.managed!, milestoneId: intent.id } }
  }), acknowledge: vi.fn(async () => {}) }
  const workspace = createStudioCreativeMediaWorkspace({ fs, scope, run: () => run, assertCurrent() {}, cache, inspectImage: blob => import('../utils/creativeImage').then(module => module.inspectCreativeImage(blob, async () => ({ width: 619, height: 619 }))) })
  const coordinator = () => new CreativeMilestoneCoordinator({ scope, client, workspace, assertCurrent() {}, journal: { load: async () => structuredClone(journal), save: async (value) => {
    journal = structuredClone(value)
  } } })
  async function register() {
    const managed = await submitCreativeMediaCandidate({ fs, scope, parent: { artifactId: 'direction', fingerprint: 'direction-v1' }, target: { kind: 'image', assetId: golden.assetId }, review: entry.review!, reason: entry.attribution, registration: entry.managed, submit, assertCurrent() {}, save: async (managed) => {
      entry = { ...entry, state: 'submitting', managed }
    } })
    entry = { ...entry, state: 'submitted', managed }
  }
  const adoptRequest = () => ({ operation: 'adopt' as const, project: { id: scope.projectId, revision, files: before }, artifacts: [{ artifactId: 'media-one', fingerprint: run.artifacts.find(item => item.id === 'media-one')!.fingerprint }], reason: 'Adopt the reviewed real image' })
  return { files, before, blobs, fs, scope, register, workspace, coordinator, cache, getRun: () => run, getEntry: () => entry, journal: () => journal, posts: () => posts, adoptRequest, lose: (value: typeof lost) => lost = value }
}

describe('real media bytes through the shared milestone coordinator', () => {
  it('persists the original registration request and retries an unknown response without source writes or duplicate artifacts', async () => {
    const f = await fixture()
    f.lose('register')
    await expect(f.register()).rejects.toThrow('registration response lost')
    const original = structuredClone(f.getEntry().managed)
    expect(f.files).toEqual(f.before)
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    await f.register()
    expect(f.getEntry().managed!.id).toBe(original!.id)
    expect(f.getEntry().managed!.request).toEqual(original!.request)
    expect(f.getRun().artifacts.filter(item => item.media)).toHaveLength(1)
    expect(f.getRun().chargedMicroPoints).toBe(0)
  })
  it('writes original bytes, confirms source and media, then conditionally undoes the binding without deleting the image', async () => {
    const f = await fixture()
    await f.register()
    const request = f.adoptRequest()
    await f.coordinator().begin(f.getRun(), request, await reviewCreativeMilestone(f.getRun(), request))
    expect(f.files).toEqual(golden.after)
    expect(Buffer.from(await f.blobs.get(f.getEntry().review!.mediaPath)!.arrayBuffer())).toEqual(image)
    expect(f.getRun().artifacts.find(item => item.id === 'media-one')!.status).toBe('adopted')
    expect(f.cache.acknowledge).toHaveBeenCalledWith(f.scope, expect.objectContaining({ operation: 'adopt', status: 'confirmed' }))
    const snapshot = await f.workspace.snapshot()
    const undo = { operation: 'undo' as const, project: { id: f.scope.projectId, files: snapshot.files, revision: snapshot.revision }, milestoneId: f.getRun().milestones![0]!.id, reason: 'Restore the reviewed source binding' }
    await f.coordinator().begin(f.getRun(), undo, await reviewCreativeMilestone(f.getRun(), undo))
    expect(f.files).toEqual(f.before)
    expect(f.blobs.size).toBe(1)
  })
  it.each(['resume', 'restore'] as const)('inspects a partial reviewed write without POST, then explicitly %s', async (operation) => {
    const f = await fixture()
    await f.register()
    const request = f.adoptRequest()
    const review = await reviewCreativeMilestone(f.getRun(), request)
    f.lose('prepare')
    await expect(f.coordinator().begin(f.getRun(), request, review)).rejects.toThrow('response lost')
    const first = review.changes[0]!
    f.files[first.path] = first.after!
    f.blobs.set(f.getEntry().review!.mediaPath, new Blob([image]))
    const posts = f.posts()
    const recovery = await f.coordinator().recover()
    expect(recovery?.projectState).toBe('partial')
    expect(f.posts()).toBe(posts)
    await f.coordinator()[operation](recovery!.entry)
    expect(f.files).toEqual(operation === 'resume' ? golden.after : f.before)
    expect(f.getRun().milestones![0]!.status).toBe(operation === 'resume' ? 'confirmed' : 'abandoned')
    expect(f.blobs.size).toBe(1)
  })
  it('keeps a corrupt third binary unchanged and refuses source writes or receipt confirmation', async () => {
    const f = await fixture()
    await f.register()
    const request = f.adoptRequest()
    f.blobs.set(f.getEntry().review!.mediaPath, new Blob(['corrupt image']))
    await expect(f.coordinator().begin(f.getRun(), request, await reviewCreativeMilestone(f.getRun(), request))).rejects.toThrow('SOURCE_CONFLICT')
    expect(f.files).toEqual(f.before)
    expect(f.fs.writeBlob).not.toHaveBeenCalled()
    expect(f.getRun().milestones![0]!.status).toBe('prepared')
    expect(f.journal()?.state).not.toBe('confirmed')
    const recovery = await f.coordinator().recover()
    expect(recovery?.sourceState).toBe('before')
    await f.coordinator().abandon(recovery!.entry)
    expect(f.getRun().milestones![0]!.status).toBe('abandoned')
    expect(f.files).toEqual(f.before)
    expect(await f.blobs.get(f.getEntry().review!.mediaPath)!.text()).toBe('corrupt image')
  })
  it('reviews the exact registered voice selection and rejects a newly changed pronunciation dictionary', async () => {
    const v = captured.voice
    const files = structuredClone(v.registered) as Record<string, string>
    const revision = await computeAgentProjectRevision(files)
    const ledger = JSON.parse(files['adv/audio/voice-ledger.json']!)
    const take = ledger.lines[v.lineId].locales[v.locale].takes[0]
    const request = { path: 'adv/chapters/intro.adv.md', line: 4, speakerId: 'lin', text: '列车还没有到，我们再等一会儿。', instruction: '平静地邀请同伴继续等待' }
    const base = (await fixture()).getRun()
    const run: CreativeTeamRun = { ...base, plan: { ...base.plan, projectId: v.id, projectRevision: revision, tasks: [{ id: 'voice', partner: 'voice-director', capability: 'direct-voice', dependsOn: [], sourcePaths: Object.keys(files), instruction: 'Frozen voice input', expectedOutput: 'Reviewed selection' }] }, tasks: [{ taskId: 'voice', status: 'completed', attempt: 1, artifactIds: ['voice-direction'] }], artifacts: [{ id: 'voice-direction', runId: base.id, taskId: 'voice', partner: 'voice-director', projectId: v.id, kind: 'voice-direction', source: { projectId: v.id, revision, files: { ...files }, upstream: [] }, fingerprint: 'voice-v1', summary: 'Frozen voice fixture', output: { kind: 'voice-direction', summary: 'Frozen voice fixture', cast: [{ speakerId: 'lin', designBrief: 'Tingting', performance: 'Calm' }, { speakerId: 'narrator', designBrief: 'Separate narrator', performance: 'Unproduced' }], dictionary: [], lines: [request] }, changes: [], reviewCapabilities: ['voice-take'], status: 'selected' }] }
    const fs = { collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date(0) })) } as IFileSystem
    const imported = { target: { artifactId: 'voice-direction', artifactFingerprint: 'voice-v1', request, lineId: v.lineId, sourceRevision: revision, locale: v.locale, profileRevision: take.voiceProfileRevision }, beforeRevision: revision, afterRevision: revision, mediaPath: `adv/assets/${JSON.parse(files['adv/assets/audio.json']!).assets[0].path}`, sha256: take.sha256, bytes: 125740, duration: 2.849478, sampleRate: 22050, takeId: take.id, attribution: 'Captured actual host speech', changes: [] }
    const review = await reviewCreativeVoiceSelection(fs, run, imported, () => {})
    expect(review.changes).toHaveLength(1)
    expect(review.changes[0]!.path).toBe('adv/audio/voice-ledger.json')
    expect(JSON.parse(review.changes[0]!.content).lines[v.lineId].locales[v.locale].selectedTake).toBe(take.id)
    expect(JSON.parse(files['adv/audio/voice-ledger.json']!).lines[v.lineId].locales[v.locale].selectedTake).toBeNull()
    files['adv/audio/pronunciation.json'] = JSON.stringify({ schemaVersion: 1, revision: 1, replacements: { 列车: '火车' }, locales: {} })
    await expect(reviewCreativeVoiceSelection(fs, run, imported, () => {})).rejects.toThrow('SOURCE_CHANGED')
    const decode = vi.fn(async (): Promise<never> => {
      throw new Error('A stale input must fail before decoding')
    })
    const host = createStudioCreativeMediaWorkspace({ fs: { ...fs, readBlob: async () => ({ size: 125740 } as Blob) }, scope: { accountId: run.accountId, projectId: v.id, runId: run.id }, run: () => run, assertCurrent() {}, inspectVoice: decode })
    await expect(host.verifyMedia!(files, [{ verification: 'author-host', parent: { artifactId: 'voice-direction', fingerprint: 'voice-v1' }, target: { kind: 'voice', phase: 'registered', assetId: v.assetId, lineId: v.lineId, locale: v.locale, takeId: v.takeId }, sha256: take.sha256, bytes: 125740, mimeType: 'audio/wav', mediaPath: imported.mediaPath }])).rejects.toThrow('SOURCE_CHANGED')
    expect(decode).not.toHaveBeenCalled()
  })
  it('rolls back all new binary writes while preserving an existing immutable file when the post-write check fails', async () => {
    const f = await fixture()
    const existing = new Blob([image])
    f.blobs.set('adv/assets/existing.webp', existing)
    const metadata = f.getEntry().image
    await expect(commitStudioProjectFiles(f.fs, [{ path: 'adv/scenes/new.md', expected: null, content: 'temporary source' }], { acceptsPath: path => path.startsWith('adv/'), media: ['existing', 'one', 'two'].map(name => ({ path: `adv/assets/${name}.webp`, blob: new Blob([image]), sha256: metadata.sha256, bytes: metadata.bytes })), validateAfter: async () => {
      throw new Error('post-write media check failed')
    } })).rejects.toThrow('post-write')
    expect(f.files).toEqual(f.before)
    expect([...f.blobs]).toEqual([['adv/assets/existing.webp', existing]])
  })
})
