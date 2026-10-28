import type { CreativeTeamClient, CreativeTeamRun } from '@advjs/agent'
import type { IFileSystem } from '../utils/fs'
import { computeAgentProjectRevision, createCreativeTeamRun, reduceCreativeTeamRun } from '@advjs/agent'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, ref, shallowRef } from 'vue'
import frozen from '../../../../packages/agent/test/fixtures/creative-team/v2/project.json'
import { useContentSave } from '../composables/useContentSave'
import { useCreativeSourceSync } from '../composables/useCreativeSourceSync'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'
import { observeStudioFileSystem, studioFileMutationRevision, subscribeStudioFileMutations, whenStudioFileMutationsSettle } from '../utils/fs/mutations'
import { commitStudioProjectFiles } from '../utils/nativeProjectMutation'
import { runStudioProjectWrite } from '../utils/projectAudio'

const auth = reactive({ userId: 'author1' })
const studio = reactive({ currentProject: { projectId: 'station' } })
const currentFs = shallowRef<IFileSystem | null>(null)
let ready: Promise<void> = Promise.resolve()
vi.mock('../stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => studio }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ getFs: () => currentFs.value, whenReady: () => ready }) }))

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}
function fileSystem() {
  const files = { ...frozen.files } as Record<string, string>
  const flush = vi.fn(async () => {})
  const fs = observeStudioFileSystem({
    backend: 'memory',
    exists: async (path: string) => path in files,
    readFile: async (path: string) => files[path]!,
    writeFile: async (path: string, content: string) => { files[path] = content },
    deleteFile: async (path: string) => { delete files[path] },
    flush,
    collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content, lastModified: new Date() })),
  } as unknown as IFileSystem)
  return { fs, files, flush }
}
async function fixture() {
  const { fs, files, flush } = fileSystem()
  let project = { id: 'station', files: { ...files }, revision: await computeAgentProjectRevision(files) }
  let server = createCreativeTeamRun({ id: 'run1', accountId: auth.userId, now: 1, plan: { protocolVersion: 1, projectId: 'station', projectRevision: project.revision, goal: '核对正常编辑器的保存', limits: { maxTasks: 1, maxToolCalls: 8, maxMicroPoints: 100, maxReworkRounds: 2 }, tasks: [{ id: 'script', partner: 'writer', capability: 'generate-chapter-draft', dependsOn: [], sourcePaths: Object.keys(files), instruction: '改写开场', expectedOutput: '候选章节' }] } })
  server = { ...server, status: 'awaiting_review', tasks: [{ ...server.tasks[0]!, status: 'awaiting_review', artifactIds: ['candidate1'] }], artifacts: [{ id: 'candidate1', runId: 'run1', taskId: 'script', partner: 'writer', projectId: 'station', kind: 'chapter', summary: '读取旧世界设定的章节', status: 'candidate', fingerprint: 'candidate-fp', reviewCapabilities: ['modify-source', 'candidate-preview'], source: { projectId: 'station', revision: project.revision, files: { ...files }, upstream: [] }, changes: [{ path: 'adv/chapters/station.adv.md', before: files['adv/chapters/station.adv.md']!, after: '# 旧候选' }] }] }
  const api = {
    availability: vi.fn(async () => ({ protocolVersion: 1, enabled: true, serviceVersion: 'local test', capabilities: ['generate-chapter-draft'], authoring: { candidateEdits: true, milestoneAdoption: true, sourceSync: true }, maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } })),
    list: vi.fn(async () => [{ id: 'run1', projectId: 'station', goal: server.plan.goal, status: server.status, revision: server.revision, chargedMicroPoints: 0, reservedMicroPoints: 0, updatedAt: 1 }]),
    get: vi.fn(async () => structuredClone(server)),
    getSourceState: vi.fn(async () => ({ run: structuredClone(server), projectRevision: project.revision })),
    refreshFacts: vi.fn(async (next: typeof project) => {
      project = structuredClone(next)
      server = reduceCreativeTeamRun(server, { type: 'refresh-facts', files: next.files }, 2)
      return structuredClone(server)
    }),
    start: vi.fn(),
    decide: vi.fn(),
    editCandidate: vi.fn(),
    milestone: vi.fn(),
    recordPlaytest: vi.fn(),
    getPlaytest: vi.fn(),
  }
  const store = useCreativeTeamStore()
  store.configure({ accountId: auth.userId, projectId: 'station', client: api as CreativeTeamClient })
  await store.refresh()
  currentFs.value = fs
  const scope = effectScope()
  const busy = ref(false)
  const sync = scope.run(() => useCreativeSourceSync(() => busy.value))!
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
  }
  return { fs, files, flush, api, store, scope, busy, sync, settle, server: () => server, setServer: (next: CreativeTeamRun) => {
    server = next
  } }
}

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  auth.userId = 'author1'
  studio.currentProject = { projectId: 'station' }
  currentFs.value = null
  ready = Promise.resolve()
})
afterEach(() => vi.useRealTimers())

describe('saved source reconciliation', () => {
  it('reopens without POST, then invalidates old candidates after the real chapter save path', async () => {
    const f = await fixture()
    try {
      await f.settle()
      expect(f.sync.status.value).toBe('current')
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
      expect(f.flush).not.toHaveBeenCalled()
      const result = await useContentSave().saveContent(f.fs, 'chapter', 'edit', { filename: 'station', title: '雨夜车站', content: '# 作者实际保存的章节\n' }, 'station')
      expect(result.success).toBe(true)
      expect(f.sync.blocked.value).toBe(true)
      await f.settle()
      expect(f.api.refreshFacts).toHaveBeenCalledOnce()
      expect(f.api.refreshFacts.mock.calls[0]![0].files['adv/chapters/station.adv.md']).toBe(f.files['adv/chapters/station.adv.md'])
      expect(f.store.run!.artifacts[0]!.status).toBe('stale')
      expect(f.sync.status.value).toBe('current')
      for (const key of ['start', 'decide', 'editCandidate', 'milestone'] as const)
        expect(f.api[key]).not.toHaveBeenCalled()
    }
    finally { f.scope.stop() }
  })

  it('waits for the project loader before capturing a filesystem and discards the former instance', async () => {
    const loaded = deferred()
    ready = loaded.promise
    const f = await fixture()
    try {
      await f.settle()
      expect(f.api.getSourceState).not.toHaveBeenCalled()
      const next = fileSystem()
      next.files['adv/world.md'] = '# 最新实例的世界\n'
      currentFs.value = next.fs
      await f.settle()
      expect(f.api.getSourceState).not.toHaveBeenCalled()
      loaded.resolve()
      await flushPromises()
      await f.settle()
      expect(f.api.refreshFacts).toHaveBeenCalledOnce()
      expect(f.api.refreshFacts.mock.calls[0]![0].files['adv/world.md']).toBe('# 最新实例的世界\n')
      expect(f.sync.status.value).toBe('current')
    }
    finally {
      loaded.resolve()
      f.scope.stop()
    }
  })

  it('waits for a whole queued transaction and uploads no intermediate file set', async () => {
    const f = await fixture()
    const release = deferred()
    try {
      await f.settle()
      const transaction = runStudioProjectWrite(f.fs, async () => {
        await f.fs.writeFile('adv/world.md', '# 新世界\n')
        await release.promise
        await f.fs.writeFile('adv/chapters/station.adv.md', '# 新章节\n')
      })
      await flushPromises()
      await f.settle()
      expect(f.sync.status.value).toBe('checking')
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
      release.resolve()
      await transaction
      await flushPromises()
      await f.settle()
      expect(f.api.refreshFacts).toHaveBeenCalledOnce()
      expect(f.api.refreshFacts.mock.calls[0]![0].files).toMatchObject({ 'adv/world.md': '# 新世界\n', 'adv/chapters/station.adv.md': '# 新章节\n' })
    }
    finally {
      release.resolve()
      f.scope.stop()
    }
  })

  it('observes a transaction rollback as unchanged sources and does not publish the failed candidate', async () => {
    const f = await fixture()
    try {
      await f.settle()
      const before = { ...f.files }
      await expect(commitStudioProjectFiles(f.fs, [{ path: 'adv/world.md', expected: before['adv/world.md']!, content: '不得上传的中间稿' }], { acceptsPath: () => true, validateAfter: async () => {
        throw new Error('verify failed')
      } })).rejects.toThrow('verify failed')
      await f.settle()
      expect(f.files).toEqual(before)
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
      expect(f.store.run!.artifacts[0]!.status).toBe('candidate')
    }
    finally { f.scope.stop() }
  })

  it('discards an obsolete source read, then reconciles the newer saved text', async () => {
    const f = await fixture()
    const response = deferred<Awaited<ReturnType<NonNullable<CreativeTeamClient['getSourceState']>>>>()
    const old = await f.api.getSourceState.getMockImplementation()!()
    f.api.getSourceState.mockReturnValueOnce(response.promise)
    try {
      await f.settle()
      await f.fs.writeFile('adv/world.md', '# 改稿后的设定\n')
      response.resolve(old)
      await flushPromises()
      await f.settle()
      expect(f.api.refreshFacts).toHaveBeenCalledOnce()
      expect(f.api.refreshFacts.mock.calls[0]![0].files['adv/world.md']).toBe('# 改稿后的设定\n')
      expect(f.sync.status.value).toBe('current')
    }
    finally { f.scope.stop() }
  })

  it('keeps an unknown response blocked until an explicit retry, without rewriting already stored facts', async () => {
    const f = await fixture()
    try {
      await f.settle()
      const save = f.api.refreshFacts.getMockImplementation()!
      f.api.refreshFacts.mockImplementationOnce(async (project) => {
        await save(project)
        throw new Error('stored response lost')
      })
      await f.fs.writeFile('adv/world.md', '# 唯一的新稿\n')
      await f.settle()
      await vi.waitFor(() => expect(f.sync.status.value).toBe('failed'))
      await vi.advanceTimersByTimeAsync(10000)
      expect(f.api.refreshFacts).toHaveBeenCalledOnce()
      f.sync.retry()
      await f.settle()
      expect(f.sync.status.value).toBe('current')
      expect(f.api.refreshFacts).toHaveBeenCalledOnce()
      expect(f.store.run!.artifacts[0]!.status).toBe('stale')
    }
    finally { f.scope.stop() }
  })

  it('defers a prepared milestone and retains completed history without posting new facts', async () => {
    const f = await fixture()
    try {
      f.setServer({ ...f.server(), milestones: [{ id: 'pending', status: 'prepared', operation: 'adopt', artifacts: [{ artifactId: 'candidate1', fingerprint: 'candidate-fp' }], anchors: [], beforeRevision: f.server().plan.projectRevision, afterRevision: 'after', requestFingerprint: 'intent', reason: '明确的准备中事务', at: 1 }] })
      await f.fs.writeFile('adv/world.md', '# 待恢复的中间文件\n')
      await f.settle()
      expect(f.sync.status.value).toBe('deferred')
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
      f.setServer({ ...f.server(), status: 'completed', milestones: [] })
      f.sync.retry()
      await f.settle()
      expect(f.sync.status.value).toBe('historical')
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
    }
    finally { f.scope.stop() }
  })

  it('allows an explicit cancellation during a pending source read and ignores its older reply', async () => {
    const f = await fixture()
    const old = await f.api.getSourceState.getMockImplementation()!()
    const response = deferred<typeof old>()
    f.api.getSourceState.mockReturnValueOnce(response.promise)
    try {
      await f.settle()
      expect(f.sync.status.value).toBe('checking')
      expect(f.store.mutating).toBe(false)
      f.api.decide.mockResolvedValue({ ...f.server(), status: 'cancelled', revision: f.server().revision + 1 })
      await f.store.decide({ type: 'cancel', reason: '作者停止后续任务' })
      expect(f.api.decide).toHaveBeenCalledOnce()
      expect(f.store.run!.status).toBe('cancelled')
      response.resolve(old)
      await flushPromises()
      await f.settle()
      expect(f.store.run!.status).toBe('cancelled')
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
    }
    finally {
      response.resolve(old)
      f.scope.stop()
    }
  })

  it('drops an old account response and removes observers on disposal', async () => {
    const f = await fixture()
    const response = deferred<Awaited<ReturnType<NonNullable<CreativeTeamClient['getSourceState']>>>>()
    const old = await f.api.getSourceState.getMockImplementation()!()
    f.api.getSourceState.mockReturnValueOnce(response.promise)
    try {
      await f.settle()
      auth.userId = 'another-author'
      f.store.disconnect()
      response.resolve(old)
      await flushPromises()
      await f.settle()
      expect(f.store.run).toBeUndefined()
      expect(f.api.refreshFacts).not.toHaveBeenCalled()
      expect(f.sync.blocked.value).toBe(false)
      f.scope.stop()
      const reads = f.api.getSourceState.mock.calls.length
      await f.fs.writeFile('adv/world.md', '独立保存')
      await f.settle()
      expect(f.api.getSourceState).toHaveBeenCalledTimes(reads)
    }
    finally { f.scope.stop() }
  })
})

describe('filesystem observations', () => {
  it('preserves adapter identity without letting listeners break writes', async () => {
    const { fs, files } = fileSystem()
    expect(observeStudioFileSystem(fs)).toBe(fs)
    const events: number[] = []
    const unsubscribe = subscribeStudioFileMutations(fs, event => events.push(event.pending))
    subscribeStudioFileMutations(fs, () => {
      throw new Error('observer failure')
    })
    await fs.writeFile('adv/world.md', '保存成功')
    expect(files['adv/world.md']).toBe('保存成功')
    expect(events).toEqual([1, 0])
    const revision = studioFileMutationRevision(fs)
    unsubscribe()
    await fs.deleteFile('adv/world.md')
    await whenStudioFileMutationsSettle(fs)
    expect(studioFileMutationRevision(fs)).toBeGreaterThan(revision)
    expect(events).toEqual([1, 0])
  })
})
