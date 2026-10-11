import type { VoiceDesignPreviewReview } from '@advjs/types'
import type { HostedAudioPublication, HostedAudioReleaseReview } from '../../../../packages/advjs/shared/hosted-audio'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowRef } from 'vue'
import { useAudioPublication } from '../composables/useAudioPublication'
import { useVoiceDesigner } from '../composables/useVoiceDesigner'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { connectLocalVoiceSession, disconnectLocalVoiceSession } from '../utils/localVoiceSession'

vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => ({ whenReady: async () => {}, getFs: () => undefined }) }))

const hash = 'a'.repeat(64)
const designReview: VoiceDesignPreviewReview = { id: 'review', reviewHash: hash, voiceId: 'designed', locale: 'zh-CN', providerId: 'configured-provider', text: '试听', expectedRevision: hash, budget: { maxCharacters: 20, allowUnknownCost: false }, characterCount: 2, characterId: 'narrator', model: 'inspected-model', providerVoiceId: 'inspected-voice', source: 'designed', presetSha256: hash, expiresAt: '2099-01-01T00:00:00Z' }
const releaseReview: HostedAudioReleaseReview = { planId: 'release', sourceRevision: hash, expectedManifestRevision: null, expiresAt: '2099-01-01T00:00:00Z', assetCount: 1, objectCount: 2, bytes: 50, assets: [{ id: 'selected', kind: 'voice', title: 'Selected' }] }
const publication: HostedAudioPublication = { revision: hash, manifestObjectKey: 'finite/manifest.json', manifestUrl: 'https://public.example/finite/manifest.json', publishedAt: '2026-10-12T00:00:00Z' }
let wrapper: ReturnType<typeof mount>
let design: ReturnType<typeof useVoiceDesigner>
let release: ReturnType<typeof useAudioPublication>

async function pair() {
  await connectLocalVoiceSession({ baseUrl: 'http://127.0.0.1:3389', accessToken: hash }, {
    actor: () => ({ projectId: useStudioStore().currentProjectId, actorId: useAuthStore().userId }),
    fetch: async () => new Response(JSON.stringify({ accountId: 'local-device', projectId: useStudioStore().currentProjectId, configured: true, jobs: [], providers: [] })),
  })
}

beforeEach(() => {
  vi.stubGlobal('location', new URL('http://localhost:3334/'))
  vi.stubGlobal('URL', class extends URL {
    static revokeObjectURL = vi.fn()
  })
  vi.stubEnv('VITE_ADVJS_VOICE_SERVICE_URL', '')
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_URL', '')
  const pinia = createPinia()
  setActivePinia(pinia)
  useStudioStore().currentProject = { projectId: 'registered-project', name: 'Native project', lastOpened: 0 }
  wrapper = mount(defineComponent({
    setup() {
      // Seed the reviewed state while the panel is cached/inactive. A new client
      // must still invalidate it before any explicit execute/publish action.
      design = useVoiceDesigner(shallowRef(false), () => {})
      release = useAudioPublication(shallowRef(false))
      return () => h('div')
    },
  }), { global: { plugins: [pinia] } })
})

afterEach(() => {
  wrapper.unmount()
  disconnectLocalVoiceSession()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function reviewed() {
  design.review.value = designReview
  design.previewId.value = 'candidate'
  design.previewUrl.value = 'blob:verified-preview'
  release.review.value = releaseReview
  release.current.value = publication
}
function discarded() {
  expect(design.review.value).toBeUndefined()
  expect(design.previewUrl.value).toBe('')
  expect(release.review.value).toBeUndefined()
  expect(release.current.value).toBeNull()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:verified-preview')
}

describe('local client identity invalidates private authoring reviews', () => {
  it('discards old design/release approvals when the same actor and project reconnect', async () => {
    await pair()
    const first = design.session.client.value
    reviewed()
    await pair()
    expect(design.session.client.value).not.toBe(first)
    expect(design.session.client.value?.scope).toEqual({ accountId: 'local-device', projectId: 'registered-project' })
    discarded()
  })

  it('immediately discards approvals and audition media on disconnect or project switch', async () => {
    await pair()
    reviewed()
    disconnectLocalVoiceSession()
    discarded()
    await pair()
    reviewed()
    useStudioStore().currentProject = { projectId: 'other-project', name: 'Other', lastOpened: 0 }
    expect(design.session.client.value).toBeUndefined()
    discarded()
  })
})
