import type cloudbase from '@cloudbase/js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import AudioLocalConnection from '../components/audio/AudioLocalConnection.vue'
import { cloudbaseAuthInjectionKey } from '../composables/useCloudbase'
import { useManagedVoiceSession } from '../composables/useManagedVoiceSession'
import en from '../i18n/locales/en.json'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { connectLocalVoiceSession, disconnectLocalVoiceSession, isLocalVoicePage, localVoiceConnecting, localVoiceSession, resolveLocalVoiceUrl } from '../utils/localVoiceSession'

const token = 'a'.repeat(64)
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const snapshot = (projectId = 'registered-project', accountId = 'local-device') => ({ configured: true, jobs: [], providers: [], accountId, projectId, canQuery: false, providerConcurrency: {} })
const wrappers: ReturnType<typeof mount>[] = []
let pinia: ReturnType<typeof createPinia>
function actor() {
  return { projectId: useStudioStore().currentProjectId, actorId: useAuthStore().userId }
}
function host(sdk?: cloudbase.auth.App, form = false) {
  let api!: ReturnType<typeof useManagedVoiceSession>
  const wrapper = mount(defineComponent({
    setup() {
      api = useManagedVoiceSession()
      return () => form ? h(AudioLocalConnection) : h('div')
    },
  }), { global: { plugins: [pinia, createI18n({ legacy: false, locale: 'en', messages: { en } })], provide: sdk ? { [cloudbaseAuthInjectionKey as symbol]: sdk } : {} } })
  wrappers.push(wrapper)
  return { api, wrapper }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  return {
    promise: new Promise<T>((accept) => {
      resolve = accept
    }),
    resolve: (value: T) => resolve(value),
  }
}
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  useStudioStore().currentProject = { projectId: 'registered-project', name: 'Native project', lastOpened: 0 }
  vi.stubGlobal('location', new URL('http://127.0.0.1:3334/'))
  vi.stubEnv('VITE_ADVJS_VOICE_SERVICE_URL', '')
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_URL', '')
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  disconnectLocalVoiceSession()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('memory-only local Studio voice pairing', () => {
  it('connects without a CloudBase SDK/session and keeps jobs, design and release on the same authenticated port', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response(snapshot()))
    const { api } = host()
    expect(useAuthStore().isLoggedIn).toBe(false)
    expect(api.configured.value).toBe(false)
    await connectLocalVoiceSession({ baseUrl: 'http://127.0.0.1:3389', accessToken: token }, { actor, fetch })
    expect(api.configured.value).toBe(true)
    expect(api.loginRequired.value).toBe(false)
    expect(api.client.value?.scope).toEqual({ accountId: 'local-device', projectId: 'registered-project' })
    for (const route of ['/jobs', '/voice-design', '/releases/current'])
      await api.client.value!.request(route)
    expect(fetch.mock.calls.map(call => String(call[0]))).toEqual(['/jobs', '/jobs', '/voice-design', '/releases/current'].map(route => `http://127.0.0.1:3389/v1/audio/projects/registered-project${route}`))
    expect(fetch.mock.calls.every(call => (call[1] as RequestInit).headers && (call[1] as RequestInit).credentials === 'omit')).toBe(true)
    expect(JSON.stringify(localVoiceSession.value)).not.toContain(token)
  })

  it('activates only after the scoped probe succeeds; failed or mismatched replies keep it disconnected', async () => {
    host()
    for (const reply of [response({}, 401), response(snapshot('different-project')), response(snapshot('registered-project', 'different-account'))]) {
      await expect(connectLocalVoiceSession({ baseUrl: 'http://127.0.0.1:3389', accessToken: token }, { actor, fetch: async () => reply })).rejects.toThrow()
      expect(localVoiceSession.value).toBeUndefined()
      expect(localVoiceConnecting.value).toBe(false)
    }
  })

  it.each(['http://other.example', 'https://other.example', 'http://audio.localhost', 'http://127.0.0.2', 'http://127.0.0.1:3389/path', 'http://127.0.0.1:3389?token=bad', 'http://user:password@localhost'])('rejects nonfinite local service URL %s', async (url) => {
    const fetch = vi.fn()
    expect(resolveLocalVoiceUrl(url)).toBeUndefined()
    await expect(connectLocalVoiceSession({ baseUrl: url, accessToken: token }, { actor, fetch })).rejects.toThrow('AUDIO_LOCAL_CONFIG_INVALID')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects remote pages and invalid pairing credentials before any request', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('location', new URL('https://studio.example.com'))
    expect(isLocalVoicePage()).toBe(false)
    await expect(connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch })).rejects.toThrow('CONFIG_INVALID')
    vi.stubGlobal('location', new URL('http://localhost:3334'))
    await expect(connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: 'not-a-pairing-token' }, { actor, fetch })).rejects.toThrow('CONFIG_INVALID')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('discards a delayed connection after project change and revokes already captured clients on disconnect', async () => {
    const { api } = host()
    const pending = deferred<Response>()
    const operation = connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch: async () => pending.promise })
    await flushPromises()
    useStudioStore().currentProject = { projectId: 'second', name: 'Second', lastOpened: 0 }
    pending.resolve(response(snapshot()))
    await expect(operation).rejects.toThrow('SCOPE_CHANGED')
    expect(api.client.value).toBeUndefined()
    await connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch: async () => response(snapshot('second')) })
    const client = api.client.value!
    disconnectLocalVoiceSession()
    await expect(client.request('/voice-design', 'POST', {})).rejects.toThrow('SCOPE_CHANGED')
  })

  it('keeps the latest connection when an older probe or read completes late', async () => {
    const { api } = host()
    const old = deferred<Response>()
    const first = connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch: async () => old.promise })
    await flushPromises()
    await connectLocalVoiceSession({ baseUrl: 'http://127.0.0.1:3390', accessToken: 'b'.repeat(64) }, { actor, fetch: async () => response(snapshot()) })
    const newest = api.client.value
    old.resolve(response(snapshot()))
    await expect(first).rejects.toThrow('SCOPE_CHANGED')
    expect(api.client.value).toBe(newest)
    expect(localVoiceSession.value?.baseUrl).toBe('http://127.0.0.1:3390')
    const read = deferred<Response>()
    await connectLocalVoiceSession({ baseUrl: 'http://127.0.0.1:3390', accessToken: token }, { actor, fetch: vi.fn().mockResolvedValueOnce(response(snapshot())).mockImplementationOnce(() => read.promise) })
    const operation = api.client.value!.request('/releases/current')
    await flushPromises()
    disconnectLocalVoiceSession()
    read.resolve(response({ manifestUrl: 'https://public.example/manifest.json' }))
    await expect(operation).rejects.toThrow('SCOPE_CHANGED')
  })

  it('disconnects on 401 and an external account change without clearing an unrelated cloud session', async () => {
    const { api } = host()
    await connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch: vi.fn().mockResolvedValueOnce(response(snapshot())).mockResolvedValueOnce(response({}, 401)) })
    await expect(api.client.value!.request('/jobs')).rejects.toThrow('LOGIN_REQUIRED')
    expect(localVoiceSession.value).toBeUndefined()
    await connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch: async () => response(snapshot()) })
    const old = api.client.value!
    await useAuthStore().restoreSession({ getSession: async () => ({ data: { session: { user: { id: 'cloud-author' }, access_token: 'test-cloud-session' } } }) } as unknown as cloudbase.auth.App)
    expect(localVoiceSession.value).toBeUndefined()
    expect(useAuthStore().isLoggedIn).toBe(true)
    await expect(old.request('/jobs')).rejects.toThrow('SCOPE_CHANGED')
  })

  it('uses local pairing first and restores the original cloud client after disconnect', async () => {
    vi.stubEnv('VITE_ADVJS_VOICE_SERVICE_URL', 'https://audio.example.com')
    const sdk = { getSession: async () => ({ data: { session: { user: { id: 'cloud-author' }, access_token: 'test-cloud-session', expires_at: 9999999999 } } }) } as unknown as cloudbase.auth.App
    await useAuthStore().restoreSession(sdk)
    const { api } = host(sdk)
    const cloud = api.client.value
    await connectLocalVoiceSession({ baseUrl: 'http://localhost:3389', accessToken: token }, { actor, fetch: async () => response(snapshot()) })
    expect(api.client.value?.scope.accountId).toBe('local-device')
    disconnectLocalVoiceSession()
    expect(api.client.value).toBe(cloud)
    expect(api.configured.value).toBe(true)
  })

  it('provides a real form without sign-in, clears the successful credential and cancels a pending probe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(snapshot())))
    const { wrapper } = host(undefined, true)
    expect(wrapper.get('[data-testid="audio-local-project-id"]').text()).toBe('registered-project')
    await wrapper.get('input[type="password"]').setValue(token)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Connected to local service')
    expect(wrapper.find('input[type="password"]').exists()).toBe(false)
    await wrapper.findAll('button').find(button => button.text() === 'Disconnect local service')!.trigger('click')
    expect(wrapper.get('input[type="password"]').element).toHaveProperty('value', '')
    const pending = deferred<Response>()
    vi.stubGlobal('fetch', vi.fn(async () => pending.promise))
    await wrapper.get('input[type="password"]').setValue(token)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await wrapper.findAll('button').find(button => button.text() === 'Cancel connection')!.trigger('click')
    pending.resolve(response(snapshot()))
    await flushPromises()
    expect(localVoiceSession.value).toBeUndefined()
    expect(wrapper.get('input[type="password"]').element).toHaveProperty('value', '')
  })
})
