import type cloudbase from '@cloudbase/js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { cloudbaseAuthInjectionKey } from '../composables/useCloudbase'
import { useManagedVoiceSession } from '../composables/useManagedVoiceSession'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
const session = (id = 'author', expires = 9999999999) => ({ data: { session: { access_token: `${id}-token`, refresh_token: 'refresh', expires_at: expires, user: { id } } } })
const wrappers: { unmount: () => void }[] = []
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()))
async function managedSession() {
  vi.stubEnv('VITE_ADVJS_VOICE_SERVICE_URL', 'http://127.0.0.1:3389')
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  const studio = useStudioStore()
  const setActor = (id: string) => auth.restoreSession({ getSession: async () => session(id) } as unknown as cloudbase.auth.App)
  await setActor('author')
  studio.currentProject = { projectId: 'station', name: 'Station', lastOpened: 0 }
  const sdk = { getSession: vi.fn(async (): Promise<unknown> => session()), refreshSession: vi.fn(async (): Promise<unknown> => session()) }
  let api!: ReturnType<typeof useManagedVoiceSession>
  const wrapper = mount(defineComponent({
    setup() {
      api = useManagedVoiceSession()
      return () => h('div')
    },
  }), { global: { plugins: [pinia], provide: { [cloudbaseAuthInjectionKey as symbol]: sdk } } })
  wrappers.push(wrapper)
  return { auth, studio, setActor, sdk, fetch, wrapper, api, client: api.client.value! }
}

describe('managed voice delayed actor operations', () => {
  it.each([
    ['getSession', 'project-return'],
    ['getSession', 'account-return'],
    ['getSession', 'unmount'],
    ['refreshSession', 'project-return'],
    ['refreshSession', 'account-return'],
    ['refreshSession', 'unmount'],
  ] as const)('prevents a pending %s project upload after %s', async (phase, change) => {
    const s = await managedSession()
    const pending = deferred<unknown>()
    if (phase === 'refreshSession')
      s.sdk.getSession.mockResolvedValueOnce(session('author', 1))
    s.sdk[phase].mockReturnValueOnce(pending.promise)
    const job = s.client.request('/sync', 'POST', { files: { 'adv.config.json': 'private source' } }).catch(error => error)
    await flushPromises()
    if (change === 'unmount') {
      s.wrapper.unmount()
      wrappers.splice(wrappers.indexOf(s.wrapper), 1)
    }
    else if (change === 'account-return') {
      await s.setActor('next-author')
      await s.setActor('author')
    }
    else {
      s.studio.currentProject = { projectId: 'other', name: 'Other', lastOpened: 0 }
      s.studio.currentProject = { projectId: 'station', name: 'Station', lastOpened: 0 }
    }
    pending.resolve(session())
    expect(await job).toBeInstanceOf(Error)
    expect(s.fetch).not.toHaveBeenCalled()
    expect(s.auth.isLoggedIn).toBe(true)
  })
  it.each(['getSession', 'refreshSession'] as const)('preserves a new actor after the previous %s fails', async (phase) => {
    const s = await managedSession()
    const pending = deferred<unknown>()
    if (phase === 'refreshSession')
      s.sdk.getSession.mockResolvedValueOnce(session('author', 1))
    s.sdk[phase].mockReturnValueOnce(pending.promise)
    const job = s.client.request('/sync', 'POST', { files: { 'adv.config.json': 'private source' } }).catch(error => error)
    await flushPromises()
    await s.setActor('next-author')
    pending.reject(new Error('Old authentication failed'))
    expect(await job).toBeInstanceOf(Error)
    expect(s.fetch).not.toHaveBeenCalled()
    expect(s.auth.userId).toBe('next-author')
    expect(s.api.client.value?.scope.accountId).toBe('next-author')
  })
  it('rejects a previous HTTP 401 after returning to the same project without expiring the current login', async () => {
    const s = await managedSession()
    const pending = deferred<Response>()
    s.fetch.mockReturnValueOnce(pending.promise)
    const job = s.client.request('/jobs').catch(error => error)
    await flushPromises()
    expect(s.fetch).toHaveBeenCalledTimes(1)
    s.studio.currentProject = { projectId: 'other', name: 'Other', lastOpened: 0 }
    s.studio.currentProject = { projectId: 'station', name: 'Station', lastOpened: 0 }
    pending.resolve(new Response('{}', { status: 401 }))
    expect(await job).toBeInstanceOf(Error)
    expect(s.auth.isLoggedIn).toBe(true)
  })
  it('does not expose an old response body after switching away and back to the same actor', async () => {
    const s = await managedSession()
    const body = deferred<string>()
    const response = new Response('{}')
    vi.spyOn(response, 'text').mockReturnValueOnce(body.promise)
    s.fetch.mockResolvedValueOnce(response)
    const job = s.client.request('/jobs').catch(error => error)
    await flushPromises()
    await s.setActor('next-author')
    await s.setActor('author')
    body.resolve('{"private":"previous response"}')
    expect(await job).toBeInstanceOf(Error)
    expect(s.auth.isLoggedIn).toBe(true)
  })
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
