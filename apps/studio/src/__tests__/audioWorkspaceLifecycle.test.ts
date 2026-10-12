import { createHash } from 'node:crypto'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, reactive, shallowRef } from 'vue'
import { useAudioWorkspace } from '../composables/useAudioWorkspace'

const mocks = vi.hoisted(() => ({
  project: { getFs: vi.fn(), whenReady: vi.fn(async () => {}), applyAudioCatalogAssets: vi.fn() },
  authoring: { forProject: vi.fn(), canSynthesize: false, initialize: vi.fn() },
  catalog: vi.fn(),
  read: vi.fn(),
  fingerprint: vi.fn(async () => 'voice-revision'),
}))
let store: { currentProjectId: string }
let auth: { userId?: string }
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => mocks.project }))
vi.mock('../composables/useAudioAuthoring', () => ({ useAudioAuthoring: () => mocks.authoring }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => store }))
vi.mock('../stores/useAuthStore', () => ({ useAuthStore: () => auth }))
vi.mock('../utils/projectAssets', () => ({ loadStudioAssetCatalog: mocks.catalog }))
vi.mock('@advjs/audio', async importOriginal => ({ ...await importOriginal<typeof import('@advjs/audio')>(), voiceAuthoringRevision: mocks.fingerprint }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

const documents = { ledger: { schemaVersion: 1, lines: {} }, catalog: { schemaVersion: 2, id: 'fixture', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [] }, mixer: { schemaVersion: 1 }, revision: 'management-revision' }
const lineIds = { first: 'line_019d137e-7abc-7000-8000-000000000001', second: 'line_019d137e-7abc-7000-8000-000000000002' }

function nativeFs(id: keyof typeof lineIds) {
  const files = {
    'adv.config.json': JSON.stringify({ id, root: 'adv', format: 'flow', entryChapterId: 'intro' }),
    'adv/settings/game.json': JSON.stringify({ title: id, locale: 'zh-CN' }),
    'adv/assets.json': JSON.stringify({ ...documents.catalog, id }),
    'adv/chapters/intro.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'intro', title: id, nodes: [{ id: 'speech', type: 'narration', lineId: lineIds[id], text: id }, { id: 'end', type: 'end' }] }),
  }
  return { exists: async () => true, collectAllFiles: async () => Object.entries(files).map(([path, content]) => ({ path, content })) }
}

const scopes: ReturnType<typeof effectScope>[] = []
function workspace() {
  const active = shallowRef(true)
  const scope = effectScope()
  scopes.push(scope)
  return { active, api: scope.run(() => useAudioWorkspace(active))! }
}

beforeEach(() => {
  vi.clearAllMocks()
  store = reactive({ currentProjectId: 'first' })
  auth = reactive({ userId: 'first-user' })
  const filesystems: Record<string, ReturnType<typeof nativeFs>> = { first: nativeFs('first'), second: nativeFs('second') }
  mocks.project.getFs.mockImplementation(() => filesystems[store.currentProjectId])
  mocks.authoring.forProject.mockReturnValue({ readProjectAudio: mocks.read })
  mocks.read.mockResolvedValue(documents)
})
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

describe('studio audio workspace lifecycle', () => {
  it('disposes an audition whose resolver finishes after leaving a cached Ionic page', async () => {
    const pending = deferred<{ src: string }>()
    const dispose = vi.fn()
    mocks.catalog.mockResolvedValue({ resolve: () => pending.promise, dispose })
    const { api, active } = workspace()
    await flushPromises()
    const operation = api.preview('bgm/calm')
    await flushPromises()
    active.value = false
    await flushPromises()
    pending.resolve({ src: 'blob:late' })
    await operation
    expect(dispose).toHaveBeenCalledOnce()
    expect(api.previewUrl.value).toBe('')
    expect(api.previewAssetId.value).toBe('')
  })

  it('disposes the previous catalog and prevents an older audition from replacing the newest', async () => {
    const old = deferred<{ src: string }>()
    const oldDispose = vi.fn()
    const newDispose = vi.fn()
    mocks.catalog.mockResolvedValueOnce({ resolve: () => old.promise, dispose: oldDispose }).mockResolvedValueOnce({ resolve: async () => ({ src: 'blob:new' }), dispose: newDispose })
    const { api } = workspace()
    await flushPromises()
    const first = api.preview('bgm/old')
    await flushPromises()
    await api.preview('bgm/new')
    old.resolve({ src: 'blob:old' })
    await first
    expect(api.previewUrl.value).toBe('blob:new')
    expect(oldDispose).toHaveBeenCalledOnce()
    api.stopPreview()
    expect(newDispose).toHaveBeenCalledOnce()
    expect(api.previewUrl.value).toBe('')
  })

  it('ignores an old project read and preserves distinct voice and management revisions', async () => {
    const old = deferred<typeof documents>()
    mocks.read.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ ...documents, catalog: { ...documents.catalog, id: 'second' }, revision: 'second-management' })
    const { api } = workspace()
    await flushPromises()
    store.currentProjectId = 'second'
    await flushPromises()
    old.resolve(documents)
    await flushPromises()
    expect(api.error.value).toBe('')
    expect(api.snapshot.value?.catalog.id).toBe('second')
    expect(api.snapshot.value?.revision).toBe('voice-revision')
    expect(api.revision.value).toBe('second-management')
    expect(api.reviewContext.value.lines).toEqual([{ lineId: lineIds.second, speakerId: 'narrator', displayText: 'second' }])
  })

  it('checks original voice bytes before audition and releases verified media on an account change', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const asset = { id: 'audio-native', type: 'audio', kind: 'voice', path: 'audio/native.wav', sha256, bytes: 4 }
    let current = new Uint8Array([9, 2, 3, 4])
    const readBlob = vi.fn(async () => ({ size: current.length, arrayBuffer: async () => current.buffer }))
    const fs = { ...nativeFs('first'), readBlob }
    mocks.project.getFs.mockReturnValue(fs)
    mocks.read.mockResolvedValue({ ...documents, catalog: { ...documents.catalog, profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [asset] } })
    const dispose = vi.fn()
    mocks.catalog.mockResolvedValue({ get: () => asset, dispose })
    const revoke = vi.fn()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:verified-original')
      static revokeObjectURL = revoke
    })
    const { api } = workspace()
    await api.reload()
    expect(api.error.value).toBe('')
    expect(api.snapshot.value).toBeDefined()
    await api.preview(asset.id, sha256)
    expect(api.previewUrl.value).toBe('')
    expect(api.error.value).toContain('VOICE_AUDIO_CHANGED')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    current = bytes
    await api.preview(asset.id, sha256)
    expect(readBlob).toHaveBeenCalledWith('adv/assets/audio/native.wav')
    expect(api.previewUrl.value).toBe('blob:verified-original')
    auth.userId = 'second-user'
    expect(api.previewUrl.value).toBe('')
    expect(revoke).toHaveBeenCalledWith('blob:verified-original')
  })
})
