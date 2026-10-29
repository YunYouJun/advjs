import type cloudbase from '@cloudbase/js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { cloudbaseAuthInjectionKey } from '../composables/useCloudbase'
import { useCreativeTeamSession } from '../composables/useCreativeTeamSession'
import { useAuthStore } from '../stores/useAuthStore'
import { useCreativeTeamStore } from '../stores/useCreativeTeamStore'
import { useStudioStore } from '../stores/useStudioStore'

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
const request = { protocolVersion: 1 as const, partner: 'director' as const, project: { id: 'station', revision: 'r1', files: { 'adv/world.md': '# Private station' } }, goal: '两个结局', locale: 'zh-CN', limits: { maxTasks: 12, maxToolCalls: 64, maxReworkRounds: 2, maxMicroPoints: 1000 } }
const availability = { protocolVersion: 1, enabled: true, serviceVersion: 'session-fixture', capabilities: ['plan-production'], maxConcurrentTasks: 1, media: { image: 'manual-import', voice: 'manual-import' } }
const wrappers: { unmount: () => void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

async function setup() {
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_URL', 'http://127.0.0.1:3391')
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_PROTOCOL', 'v2')
  vi.stubEnv('VITE_ADVJS_AI_RUNTIME_APPLICATION_ID', 'advjs-studio-web')
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(availability), { status: 200, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetch)
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  const studio = useStudioStore()
  const store = useCreativeTeamStore()
  const setActor = (id: string) => auth.restoreSession({ getSession: async () => session(id) } as unknown as cloudbase.auth.App)
  await setActor('author')
  studio.currentProject = { projectId: 'station', name: 'Station', lastOpened: 0 }
  // Isolate explicit author dispatch from the independent free polling path.
  vi.spyOn(store, 'refresh').mockResolvedValue()
  const configure = vi.spyOn(store, 'configure')
  const sdk = { getSession: vi.fn(async (): Promise<unknown> => session()), refreshSession: vi.fn(async (): Promise<unknown> => session()) }
  const wrapper = mount(defineComponent({
    setup() {
      useCreativeTeamSession()
      return () => h('div')
    },
  }), { global: { plugins: [pinia], provide: { [cloudbaseAuthInjectionKey as symbol]: sdk } } })
  wrappers.push(wrapper)
  const currentClient = () => configure.mock.calls.at(-1)![0].client
  return { auth, studio, store, sdk, fetch, wrapper, setActor, currentClient }
}

describe('creative team SDK session ownership', () => {
  it.each(['project', 'account', 'project-return', 'account-return', 'unmount'] as const)('blocks a pending author POST after %s and preserves the current login', async (change) => {
    const state = await setup()
    const pending = deferred<unknown>()
    state.sdk.getSession.mockReturnValueOnce(pending.promise)
    const result = state.currentClient().start(request, 'explicit-author-intent').catch(error => error)
    await flushPromises()
    if (change === 'account' || change === 'account-return') {
      await state.setActor('next-author')
      if (change === 'account-return')
        await state.setActor('author')
      state.sdk.getSession.mockResolvedValue(session(change === 'account' ? 'next-author' : 'author'))
    }
    else if (change === 'unmount') {
      state.wrapper.unmount()
      wrappers.splice(wrappers.indexOf(state.wrapper), 1)
    }
    else {
      state.studio.currentProject = { projectId: 'different-project', name: 'Other', lastOpened: 0 }
      if (change === 'project-return')
        state.studio.currentProject = { projectId: 'station', name: 'Station', lastOpened: 0 }
    }
    pending.resolve(session())
    expect(await result).toBeInstanceOf(Error)
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.auth.userId).toBe(change === 'account' ? 'next-author' : 'author')
    expect(state.auth.isLoggedIn).toBe(true)
    if (change !== 'unmount') {
      await expect(state.currentClient().availability()).resolves.toEqual(availability)
      expect(state.fetch).toHaveBeenCalledTimes(1)
      expect(state.fetch.mock.calls[0]![1]).toMatchObject({ headers: expect.objectContaining({ authorization: `Bearer ${change === 'account' ? 'next-author' : 'author'}-token` }) })
    }
  })

  it.each(['resolve', 'reject'] as const)('ignores a stale token refresh that will %s after a project change', async (outcome) => {
    const state = await setup()
    const pending = deferred<unknown>()
    state.sdk.getSession.mockResolvedValueOnce(session('author', 1))
    state.sdk.refreshSession.mockReturnValueOnce(pending.promise)
    const result = state.currentClient().start(request, 'explicit-author-intent').catch(error => error)
    await flushPromises()
    expect(state.sdk.refreshSession).toHaveBeenCalledTimes(1)
    state.studio.currentProject = { projectId: 'other', name: 'Other', lastOpened: 0 }
    if (outcome === 'reject')
      pending.reject(new Error('The old refresh failed'))
    else
      pending.resolve(session())
    expect(await result).toBeInstanceOf(Error)
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.auth.isLoggedIn).toBe(true)
    expect(state.store.connected).toBe(true)
  })

  it('still clears the active login when the current SDK session expires', async () => {
    const state = await setup()
    state.sdk.getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(state.currentClient().availability()).rejects.toThrow()
    expect(state.fetch).not.toHaveBeenCalled()
    expect(state.auth.isLoggedIn).toBe(false)
    expect(state.store.connected).toBe(false)
  })
})
