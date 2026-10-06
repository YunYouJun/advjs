import { flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import ProjectOverview from '../components/ProjectOverview.vue'
import en from '../i18n/locales/en.json'

const state = vi.hoisted(() => ({ content: undefined as unknown, validate: vi.fn(async () => ({ passed: true, issues: [] })) }))
vi.mock('../utils/projectValidation', () => ({ validateProject: state.validate, autoFixIssues: vi.fn() }))
vi.mock('../composables/useProjectContent', () => ({ useProjectContent: () => state.content }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../stores/useStudioStore', () => ({ useStudioStore: () => ({ currentProject: { name: 'Test' } }) }))
vi.mock('../stores/useManagedAgentStore', () => ({ useManagedAgentStore: () => ({ isConfigured: ref(false) }) }))
vi.mock('../stores/useWorldEventStore', () => ({ useWorldEventStore: () => ({ events: [] }) }))
vi.mock('../composables/useProjectDescription', () => ({ useProjectDescription: () => ({
  ...Object.fromEntries(['worldMd', 'outlineMd', 'glossaryMd', 'propsMd', 'writingStyleMd'].map(key => [key, ref('')])),
  extractTitle: () => '',
  extractPreview: () => '',
  extractSections: () => [],
}) }))
vi.mock('../composables/useCloudSync', () => ({ useCloudSync: () => ({
  syncStatus: ref('idle'),
  isSyncing: ref(false),
  lastSyncTime: ref(null),
  pendingConflicts: ref([]),
  isCosConfigured: () => false,
}) }))

let wrapper: ReturnType<typeof shallowMount> | undefined
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})
function mountOverview(loading: boolean) {
  const isLoading = ref(loading)
  state.content = {
    isLoading,
    chapters: ref([{ file: 'adv/chapters/one.adv.md', name: 'One', content: '# One', preview: '' }]),
    characters: ref([]),
    scenes: ref([]),
    locations: ref([]),
    audios: ref([]),
    stats: ref({ chapters: 1, characters: 0, scenes: 0, locations: 0, audios: 0, knowledge: 0 }),
    knowledgeBase: { domains: ref([]) },
    getFs: () => null,
  }
  wrapper = shallowMount(ProjectOverview, { global: { plugins: [createI18n({ legacy: false, locale: 'en', messages: { en } })] } })
  return isLoading
}

describe('project overview initial validation', () => {
  it('mounts and validates cached content when returning from a resource page', async () => {
    expect(() => mountOverview(false)).not.toThrow()
    await flushPromises()
    expect(state.validate).toHaveBeenCalledTimes(1)
  })
  it('waits for content to load, then validates once', async () => {
    const loading = mountOverview(true)
    await flushPromises()
    expect(state.validate).not.toHaveBeenCalled()
    loading.value = false
    await flushPromises()
    expect(state.validate).toHaveBeenCalledTimes(1)
    loading.value = true
    await flushPromises()
    loading.value = false
    await flushPromises()
    expect(state.validate).toHaveBeenCalledTimes(1)
  })
})
