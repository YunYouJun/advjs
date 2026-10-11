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
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => mocks.project }))
vi.mock('../composables/useAudioAuthoring', () => ({ useAudioAuthoring: () => mocks.authoring }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => store }))
vi.mock('../utils/projectAssets', () => ({ loadStudioAssetCatalog: mocks.catalog }))
vi.mock('@advjs/audio', async importOriginal => ({ ...await importOriginal<typeof import('@advjs/audio')>(), voiceAuthoringRevision: mocks.fingerprint }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

const documents = { ledger: { schemaVersion: 1, lines: {} }, catalog: { schemaVersion: 2, id: 'fixture', profiles: {}, assets: [] }, mixer: { schemaVersion: 1 }, revision: 'management-revision' }
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
  mocks.project.getFs.mockReturnValue({ exists: async () => true })
  mocks.authoring.forProject.mockReturnValue({ readProjectAudio: mocks.read })
  mocks.read.mockResolvedValue(documents)
})
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()))

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
    expect(api.snapshot.value?.catalog.id).toBe('second')
    expect(api.snapshot.value?.revision).toBe('voice-revision')
    expect(api.revision.value).toBe('second-management')
  })
})
