import type cloudbase from '@cloudbase/js-sdk'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { cloudbaseAuthInjectionKey } from '../composables/useCloudbase'
import { useManagedVoiceSession } from '../composables/useManagedVoiceSession'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
describe('managed voice SDK actor boundary', () => {
  it.each(['session', 'refresh'])('blocks an external actor change during %s before sending any native project data', async (change) => {
    vi.stubEnv('VITE_ADVJS_VOICE_SERVICE_URL', 'http://127.0.0.1:3389')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const pinia = createPinia()
    setActivePinia(pinia)
    useStudioStore().currentProject = { projectId: 'registered-project', name: 'Author project', lastOpened: 0 }
    let actor = 'author'
    const session = (id: string) => ({ data: { session: { access_token: `${id}-token`, refresh_token: 'refresh', expires_at: change === 'refresh' ? 1 : 9999999999, user: { id } } } })
    const sdk = { getSession: async () => session(actor), refreshSession: async () => session('different-author') } as unknown as cloudbase.auth.App
    const auth = useAuthStore()
    await auth.restoreSession(sdk)
    let api!: ReturnType<typeof useManagedVoiceSession>
    const wrapper = mount(defineComponent({
      setup() {
        api = useManagedVoiceSession()
        return () => h('div')
      },
    }), { global: { plugins: [pinia], provide: { [cloudbaseAuthInjectionKey as symbol]: sdk } } })
    const client = api.client.value!
    expect(client.scope).toEqual({ accountId: 'author', projectId: 'registered-project' })
    if (change === 'session')
      actor = 'different-author'
    await expect(client.request('/sync', 'POST', { files: { 'adv.config.json': 'private native document' } })).rejects.toThrow('SCOPE_CHANGED')
    expect(fetch).not.toHaveBeenCalled()
    expect(auth.isLoggedIn).toBe(false)
    expect(api.client.value).toBeUndefined()
    wrapper.unmount()
  })
})
