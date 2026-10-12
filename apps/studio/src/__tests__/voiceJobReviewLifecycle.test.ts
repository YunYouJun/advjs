import type { VoiceAuthoringSnapshot } from '@advjs/types'
import type { ManagedVoiceClient } from '../utils/managedVoiceClient'
import { createMemoryVoiceGenerationStore, planVoiceGeneration, voiceGenerationInputFingerprint } from '@advjs/audio'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, shallowRef } from 'vue'
import { useHostedVoiceJobs } from '../composables/useHostedVoiceJobs'
import { useVoiceGenerationJobs } from '../composables/useVoiceGenerationJobs'
import { resolveStudioVoiceJobInput, studioVoiceGenerationTransportKey } from '../utils/voiceGeneration'

const fs = {}
const project = { getFs: () => fs, whenReady: async () => {} }
const snapshot: VoiceAuthoringSnapshot = { revision: 'a'.repeat(64), ledger: { schemaVersion: 1, lines: {} }, catalog: { schemaVersion: 2, id: 'native', defaultProfile: 'local', profiles: { local: { provider: 'project' } }, assets: [] } }
const context = { lines: [{ chapterId: 'intro', lineId: 'line_019d137e-7abc-7000-8000-000000000001', speakerId: 'hero', displayText: 'Hero' }], chapters: [{ id: 'intro', title: 'Intro' }], profiles: { hero: { intent: {}, locales: { 'zh-CN': { providers: { native: { model: 'model', voiceId: 'voice', source: 'system' as const } } } } } }, unidentifiedLines: 0 }
let store = createMemoryVoiceGenerationStore()
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => project }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => reactive({ currentProjectId: 'project' }) }))
vi.mock('../stores/useAuthStore', () => ({ useAuthStore: () => reactive({ isLoggedIn: false }) }))
vi.mock('../composables/useManagedVoiceSession', () => ({ useManagedVoiceSession: () => ({ configured: shallowRef(false), client: shallowRef() }) }))
vi.mock('../utils/projectAudio', () => ({ createStudioAudioService: () => ({ read: async () => snapshot }) }))
vi.mock('../utils/voiceGenerationStore', async original => ({ ...await original<typeof import('../utils/voiceGenerationStore')>(), createStudioVoiceGenerationStore: () => store }))
vi.mock('../utils/voiceGeneration', async original => ({ ...await original<typeof import('../utils/voiceGeneration')>(), readStudioVoiceJobContext: async () => context }))
const budget = { maxCharacters: 100, concurrency: 1, allowUnknownCost: true }
const options = { chapterId: 'intro', speakerId: 'hero', locale: 'zh-CN', providerId: 'native', mode: 'chapter' as const, budget }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => resolve = accept)
  return { promise, resolve }
}
const wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => store = createMemoryVoiceGenerationStore())
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))

describe('studio review request invalidation', () => {
  it('never revives or enqueues a hosted plan returned after the role scope changed', async () => {
    const input = await resolveStudioVoiceJobInput(context, snapshot, { ...options, lineId: context.lines[0]!.lineId })
    const proposed = { plan: await planVoiceGeneration({ accountId: 'local-device', projectId: 'project', snapshot, lines: [{ ...input, estimatedCost: null }], budget }), reviewId: 'review', reviewHash: 'b'.repeat(64) }
    expect(proposed.plan.tasks[0]!.inputFingerprint).toBe(await voiceGenerationInputFingerprint(input))
    const pending = deferred<typeof proposed>()
    const host = { scope: { accountId: 'local-device', projectId: 'project' }, assertCurrent: vi.fn(), read: async () => ({ configured: true, jobs: [], providers: [] }), syncNativeProject: async () => ({ context, snapshot }), prepare: async (value: typeof input) => value, plan: vi.fn(() => pending.promise), enqueue: vi.fn() }
    let api!: ReturnType<typeof useHostedVoiceJobs>
    wrappers.push(mount(defineComponent({ setup() {
      api = useHostedVoiceJobs(shallowRef(true), shallowRef(host as unknown as ManagedVoiceClient))
      return () => h('div')
    } })))
    await flushPromises()
    const reviewing = api.review(options)
    await flushPromises()
    await vi.waitFor(() => expect(host.plan).toHaveBeenCalledOnce())
    api.invalidatePlan()
    pending.resolve(proposed)
    await reviewing
    expect(api.plan.value).toBeUndefined()
    await api.enqueue()
    expect(host.enqueue).not.toHaveBeenCalled()
    expect(api.busy.value).toBe(false)
  })
  it('invalidates local reviewed inputs while an asynchronous quote is outstanding', async () => {
    const pending = deferred<null>()
    const quote = vi.fn(() => pending.promise)
    let api!: ReturnType<typeof useVoiceGenerationJobs>
    wrappers.push(mount(defineComponent({ setup() {
      api = useVoiceGenerationJobs(shallowRef(true))
      return () => h('div')
    } }), { global: { provide: { [studioVoiceGenerationTransportKey as symbol]: { prepare: async (input: unknown) => input, quote, execute: vi.fn() } } } }))
    await flushPromises()
    const reviewing = api.review(options)
    await flushPromises()
    await vi.waitFor(() => expect(quote).toHaveBeenCalledOnce())
    api.invalidatePlan()
    pending.resolve(null)
    await reviewing
    expect(api.plan.value).toBeUndefined()
    await api.enqueue()
    expect((await store.read()).jobs).toEqual({})
    expect(api.busy.value).toBe(false)
  })
})
