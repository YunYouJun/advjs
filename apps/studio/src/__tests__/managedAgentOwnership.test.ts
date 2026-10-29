import type { AgentRequest, AgentRun, AgentTaskSnapshot, ManagedAgentPointsAccount } from '@advjs/agent'
import type cloudbase from '@cloudbase/js-sdk'
import { ManagedAgentPointsClient } from '@advjs/agent'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { routerKey } from 'vue-router'
import { cloudbaseAuthInjectionKey } from '../composables/useCloudbase'
import { useManagedAgentSession } from '../composables/useManagedAgentSession'
import { useAuthStore } from '../stores/useAuthStore'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
const sdkSession = (id = 'author', expires = 9999999999) => ({ data: { session: { access_token: `${id}-token`, refresh_token: 'refresh', expires_at: expires, user: { id } } } })
const request: AgentRequest = { clientRequestId: 'author-intent', capability: 'generate-outline', input: { premise: 'private author premise' }, locale: 'zh-CN', project: { id: 'station', revision: 'r1', files: { 'adv/world.md': '# Private station' } } }
const account = (available = 100): ManagedAgentPointsAccount => ({ availableMicroPoints: available, reservedMicroPoints: 0, chargedMicroPoints: 0 })
const wrappers: { unmount: () => void }[] = []
beforeEach(() => setActivePinia(createPinia()))
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

async function setupSession() {
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_URL', 'http://runtime.localhost:3392')
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_PROTOCOL', 'v2')
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_APPLICATION_ID', 'advjs-studio-web')
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(account(200)), { status: 200 }))
  vi.stubGlobal('fetch', fetch)
  const auth = useAuthStore()
  const store = useManagedAgentStore()
  const setActor = (id: string) => auth.restoreSession({ getSession: async () => sdkSession(id) } as unknown as cloudbase.auth.App)
  await setActor('author')
  vi.spyOn(store, 'refreshPoints').mockResolvedValue()
  const configure = vi.spyOn(store, 'configure')
  const replace = vi.fn(async () => {})
  const sdk = { getSession: vi.fn(async (): Promise<unknown> => sdkSession()), refreshSession: vi.fn(async (): Promise<unknown> => sdkSession()) }
  const wrapper = mount(defineComponent({
    setup() {
      useManagedAgentSession()
      return () => h('div')
    },
  }), { global: { plugins: [getActivePinia()!], provide: { [cloudbaseAuthInjectionKey as symbol]: sdk, [routerKey as symbol]: { replace } } } })
  return { auth, store, setActor, sdk, fetch, configure, replace, wrapper, current: () => configure.mock.calls.at(-1)![0] }
}

describe('legacy managed AI session ownership', () => {
  it('calls the default native fetch with the browser receiver', async () => {
    vi.stubGlobal('fetch', function (this: unknown) {
      if (this !== globalThis)
        throw new TypeError('Illegal invocation')
      return Promise.resolve(new Response(JSON.stringify(account(200)), { status: 200 }))
    })
    const client = new ManagedAgentPointsClient({ baseUrl: 'http://localhost:3392', getAccessToken: () => 'fixture-token', protocol: 'v2', applicationId: 'advjs-studio-web' })
    await expect(client.getPoints()).resolves.toEqual(account(200))
  })
  it.each([
    ['getSession', 'account'],
    ['getSession', 'account-return'],
    ['getSession', 'unmount'],
    ['refreshSession', 'account'],
    ['refreshSession', 'account-return'],
    ['refreshSession', 'unmount'],
  ] as const)('blocks an old pending %s POST after %s and keeps the current login', async (phase, change) => {
    const s = await setupSession()
    const pending = deferred<unknown>()
    wrappers.push(s.wrapper)
    if (phase === 'refreshSession')
      s.sdk.getSession.mockResolvedValueOnce(sdkSession('author', 1))
    s.sdk[phase].mockReturnValueOnce(pending.promise)
    const job = s.current().runtime.start(request).catch(error => error)
    await flushPromises()
    if (change === 'unmount') {
      s.wrapper.unmount()
      wrappers.splice(wrappers.indexOf(s.wrapper), 1)
    }
    else {
      await s.setActor('next-author')
      if (change === 'account-return')
        await s.setActor('author')
    }
    pending.resolve(sdkSession())
    expect(await job).toBeInstanceOf(Error)
    expect(s.fetch).not.toHaveBeenCalled()
    expect(s.auth.userId).toBe(change === 'account' ? 'next-author' : 'author')
    expect(s.replace).not.toHaveBeenCalled()
    if (change !== 'unmount') {
      expect(s.configure).toHaveBeenCalledTimes(change === 'account' ? 2 : 3)
      s.sdk.getSession.mockResolvedValue(sdkSession(change === 'account' ? 'next-author' : 'author'))
      await expect(s.current().points.getPoints()).resolves.toEqual(account(200))
    }
  })
  it.each(['getSession', 'refreshSession'] as const)('preserves a replacement login when the old %s fails', async (phase) => {
    const s = await setupSession()
    const pending = deferred<unknown>()
    wrappers.push(s.wrapper)
    if (phase === 'refreshSession')
      s.sdk.getSession.mockResolvedValueOnce(sdkSession('author', 1))
    s.sdk[phase].mockReturnValueOnce(pending.promise)
    const job = s.current().runtime.start(request).catch(error => error)
    await flushPromises()
    await s.setActor('next-author')
    pending.reject(new Error('Previous SDK operation failed'))
    expect(await job).toBeInstanceOf(Error)
    expect(s.auth.userId).toBe('next-author')
    expect(s.store.isConfigured).toBe(true)
    expect(s.fetch).not.toHaveBeenCalled()
    expect(s.replace).not.toHaveBeenCalled()
  })
  it('rejects an SDK account mismatch and expires only the active mirror', async () => {
    const s = await setupSession()
    wrappers.push(s.wrapper)
    s.sdk.getSession.mockResolvedValueOnce(sdkSession('different-sdk-user'))
    await expect(s.current().points.getPoints()).rejects.toThrow()
    expect(s.fetch).not.toHaveBeenCalled()
    expect(s.auth.isLoggedIn).toBe(false)
    expect(s.replace).toHaveBeenCalledTimes(1)
  })
})

function snapshot(taskId: string): AgentTaskSnapshot {
  return { protocolVersion: 1, taskId, capability: 'generate-outline', status: 'queued', billingStatus: 'reserved', projectId: 'station', projectRevision: 'r1', streamText: '', streamRevision: 0, reservedMicroPoints: 1, points: { reservedMicroPoints: 1, chargedMicroPoints: 0 }, createdAt: 1, updatedAt: 1 }
}
function taskRun(taskId: string): AgentRun {
  return { taskId, events: (async function* () {
    await new Promise(() => {})
  })(), result: new Promise(() => {}) }
}
function connection(taskId = 'current-task') {
  return { runtime: { start: vi.fn(async () => taskRun(taskId)), getTask: vi.fn(async () => snapshot(taskId)), resume: vi.fn(async () => taskRun(taskId)), cancel: vi.fn(async () => {}) }, points: { getPoints: vi.fn(async () => account(200)) } }
}

describe('legacy managed AI state after reconnecting an account', () => {
  it.each(['resolve', 'reject'] as const)('does not let an old points request %s into the new account or clear its pending refresh', async (outcome) => {
    const store = useManagedAgentStore()
    const a = connection('old-task')
    const b = connection()
    const old = deferred<ManagedAgentPointsAccount>()
    const current = deferred<ManagedAgentPointsAccount>()
    a.points.getPoints.mockReturnValueOnce(old.promise)
    b.points.getPoints.mockReturnValueOnce(current.promise)
    store.configure(a)
    const first = store.refreshPoints()
    store.configure(b)
    const second = store.refreshPoints()
    if (outcome === 'reject')
      old.reject(new Error('Old account failed'))
    else
      old.resolve({ ...account(1), activeTask: 'old-task' })
    await first
    expect(store.points).toBeUndefined()
    expect(store.task).toBeUndefined()
    expect(store.error).toBeUndefined()
    expect(store.isRefreshing).toBe(true)
    expect(b.runtime.getTask).not.toHaveBeenCalled()
    current.resolve(account(200))
    await second
    expect(store.points).toEqual(account(200))
  })
  it('does not resume an old task through the new runtime after recovery finishes late', async () => {
    const store = useManagedAgentStore()
    const a = connection('old-task')
    const b = connection()
    const old = deferred<AgentTaskSnapshot>()
    a.points.getPoints.mockResolvedValue({ ...account(), activeTask: 'old-task' })
    a.runtime.getTask.mockReturnValueOnce(old.promise)
    store.configure(a)
    const first = store.refreshPoints()
    await flushPromises()
    store.configure(b)
    await store.refreshPoints()
    old.resolve(snapshot('old-task'))
    await first
    expect(store.task).toBeUndefined()
    expect(store.points).toEqual(account(200))
    expect(b.runtime.resume).not.toHaveBeenCalled()
  })
  it.each(['resolve', 'reject'] as const)('does not bind an old submission that will %s after an account switch', async (outcome) => {
    const store = useManagedAgentStore()
    const a = connection('old-task')
    const b = connection()
    const old = deferred<AgentRun>()
    a.runtime.start.mockReturnValueOnce(old.promise)
    store.configure(a)
    const first = store.startTask(request).catch(error => error)
    store.configure(b)
    await store.refreshPoints()
    if (outcome === 'resolve')
      old.resolve(taskRun('old-task'))
    else
      old.reject(new Error('Old submission failed'))
    expect(await first).toBeInstanceOf(Error)
    expect(store.task).toBeUndefined()
    expect(store.error).toBeUndefined()
    expect(b.points.getPoints).toHaveBeenCalledTimes(1)
  })
  it.each(['resolve', 'reject'] as const)('keeps an explicit old reconnect that will %s out of the new account', async (outcome) => {
    const store = useManagedAgentStore()
    const a = connection('old-task')
    const b = connection()
    const old = deferred<AgentTaskSnapshot>()
    a.points.getPoints.mockResolvedValue({ ...account(), activeTask: 'old-task' })
    store.configure(a)
    await store.refreshPoints({ resume: false })
    a.runtime.getTask.mockReturnValueOnce(old.promise)
    const first = store.reconnect()
    store.configure(b)
    await store.refreshPoints()
    if (outcome === 'resolve')
      old.resolve(snapshot('old-task'))
    else
      old.reject(new Error('Old recovery failed'))
    await first
    expect(store.task).toBeUndefined()
    expect(store.error).toBeUndefined()
    expect(b.runtime.resume).not.toHaveBeenCalled()
  })
  it('does not let a late cancellation clear the new account cancellation or refresh its points', async () => {
    const store = useManagedAgentStore()
    const a = connection('old-task')
    const b = connection()
    const old = deferred<void>()
    const current = deferred<void>()
    a.points.getPoints.mockResolvedValue({ ...account(), activeTask: 'old-task' })
    b.points.getPoints.mockResolvedValue({ ...account(200), activeTask: 'current-task' })
    a.runtime.cancel.mockReturnValueOnce(old.promise)
    b.runtime.cancel.mockReturnValueOnce(current.promise)
    store.configure(a)
    await store.refreshPoints({ resume: false })
    const first = store.cancelActiveTask()
    store.configure(b)
    await store.refreshPoints({ resume: false })
    const second = store.cancelActiveTask()
    old.resolve()
    await first
    expect(store.isCancelling).toBe(true)
    expect(store.task?.taskId).toBe('current-task')
    expect(b.points.getPoints).toHaveBeenCalledTimes(1)
    current.resolve()
    await second
    expect(store.isCancelling).toBe(false)
  })
})
