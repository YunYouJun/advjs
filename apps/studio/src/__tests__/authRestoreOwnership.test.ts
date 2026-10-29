import type cloudbase from '@cloudbase/js-sdk'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../stores/useAuthStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
const session = (id: string) => ({ data: { session: { access_token: `${id}-fixture-token`, user: { id, name: id }, expires_at: 9999999999 } } })
const sdk = (methods: { getSession: () => Promise<unknown>, getUser?: () => Promise<unknown>, signOut?: () => Promise<unknown> }) => methods as unknown as cloudbase.auth.App
beforeEach(() => setActivePinia(createPinia()))

describe('authoritative auth mirror ownership', () => {
  it.each(['success', 'error', 'empty'] as const)('discards a superseded restore with %s after the new account has loaded', async (outcome) => {
    const store = useAuthStore()
    const old = deferred<unknown>()
    const first = store.restoreSession(sdk({ getSession: () => old.promise }))
    await expect(store.restoreSession(sdk({ getSession: async () => session('new-author') }))).resolves.toBe(true)
    if (outcome === 'error')
      old.reject(new Error('Previous restore failed'))
    else
      old.resolve(outcome === 'empty' ? { data: { session: null } } : session('old-author'))
    await expect(first).resolves.toBe(false)
    expect(store.userId).toBe('new-author')
    expect(store.session?.accessToken).toBe('new-author-fixture-token')
    expect(store.authError).toBeUndefined()
    expect(store.isRestoring).toBe(false)
  })

  it('keeps the newest restore pending when an older restore finishes first', async () => {
    const store = useAuthStore()
    const old = deferred<unknown>()
    const current = deferred<unknown>()
    const first = store.restoreSession(sdk({ getSession: () => old.promise }))
    const second = store.restoreSession(sdk({ getSession: () => current.promise }))
    old.resolve(session('old-author'))
    await expect(first).resolves.toBe(false)
    expect(store.isRestoring).toBe(true)
    expect(store.userId).toBeUndefined()
    current.resolve(session('new-author'))
    await expect(second).resolves.toBe(true)
    expect(store.isRestoring).toBe(false)
    expect(store.userId).toBe('new-author')
  })

  it.each(['success', 'error'] as const)('does not let a delayed old profile %s restore the previous account', async (outcome) => {
    const store = useAuthStore()
    const profile = deferred<unknown>()
    const getUser = vi.fn(() => profile.promise)
    const first = store.restoreSession(sdk({ getSession: async () => session('old-author'), getUser }))
    await flushPromises()
    expect(getUser).toHaveBeenCalledOnce()
    await store.restoreSession(sdk({ getSession: async () => session('new-author') }))
    if (outcome === 'error')
      profile.reject(new Error('Old profile failed'))
    else
      profile.resolve({ data: { user: { id: 'old-author', name: 'Previous profile' } } })
    await expect(first).resolves.toBe(false)
    expect(store.userId).toBe('new-author')
    expect(store.displayName).toBe('new-author')
    expect(store.authError).toBeUndefined()
  })

  it('does not resurrect a pending session after an explicit clear', async () => {
    const store = useAuthStore()
    const old = deferred<unknown>()
    const first = store.restoreSession(sdk({ getSession: () => old.promise }))
    store.clearSession()
    expect(store.isRestoring).toBe(false)
    old.resolve(session('old-author'))
    await expect(first).resolves.toBe(false)
    expect(store.isLoggedIn).toBe(false)
    expect(store.session).toBeUndefined()
  })

  it('clears the local author immediately on logout and invalidates a pending restore', async () => {
    const store = useAuthStore()
    const old = deferred<unknown>()
    const signedOut = deferred<unknown>()
    await store.restoreSession(sdk({ getSession: async () => session('author') }))
    const first = store.restoreSession(sdk({ getSession: () => old.promise }))
    const logout = store.logout(sdk({ getSession: async () => session('author'), signOut: () => signedOut.promise }))
    expect(store.isLoggedIn).toBe(false)
    expect(store.isRestoring).toBe(false)
    old.resolve(session('author'))
    await expect(first).resolves.toBe(false)
    signedOut.resolve({})
    await expect(logout).resolves.toBe(true)
    expect(store.isLoggedIn).toBe(false)
  })

  it.each(['success', 'error-response', 'error'] as const)('does not clear a replacement account when an old logout returns %s', async (outcome) => {
    const store = useAuthStore()
    const signedOut = deferred<unknown>()
    await store.restoreSession(sdk({ getSession: async () => session('author') }))
    const logout = store.logout(sdk({ getSession: async () => session('author'), signOut: () => signedOut.promise }))
    await store.restoreSession(sdk({ getSession: async () => session('new-author') }))
    if (outcome === 'error')
      signedOut.reject(new Error('Old sign-out failed'))
    else
      signedOut.resolve(outcome === 'error-response' ? { error: { message: 'Old sign-out rejected' } } : {})
    await expect(logout).resolves.toBe(false)
    expect(store.userId).toBe('new-author')
    expect(store.authError).toBeUndefined()
    expect(store.isLoggedIn).toBe(true)
  })

  it.each(['error-response', 'error'] as const)('keeps the active local mirror signed out when the current logout has %s', async (outcome) => {
    const store = useAuthStore()
    await store.restoreSession(sdk({ getSession: async () => session('author') }))
    const auth = sdk({ getSession: async () => session('author'), signOut: async () => {
      if (outcome === 'error')
        throw new Error('Current sign-out failed')
      return { error: { message: 'Current sign-out failed' } }
    } })
    await expect(store.logout(auth)).rejects.toThrow('Current sign-out failed')
    expect(store.isLoggedIn).toBe(false)
    expect(store.isRestoring).toBe(false)
  })
  it('still confirms logout when SDK sign-out synchronization restores an empty session', async () => {
    const store = useAuthStore()
    const signedOut = deferred<unknown>()
    await store.restoreSession(sdk({ getSession: async () => session('author') }))
    const logout = store.logout(sdk({ getSession: async () => session('author'), signOut: () => signedOut.promise }))
    await store.restoreSession(sdk({ getSession: async () => ({ data: { session: null } }) }))
    signedOut.resolve({})
    await expect(logout).resolves.toBe(true)
    expect(store.isLoggedIn).toBe(false)
  })
  it('does not finish a newer pending login when an old logout completes', async () => {
    const store = useAuthStore()
    const signedOut = deferred<unknown>()
    const restored = deferred<unknown>()
    await store.restoreSession(sdk({ getSession: async () => session('author') }))
    const logout = store.logout(sdk({ getSession: async () => session('author'), signOut: () => signedOut.promise }))
    const login = store.restoreSession(sdk({ getSession: () => restored.promise }))
    signedOut.resolve({})
    await expect(logout).resolves.toBe(false)
    expect(store.isRestoring).toBe(true)
    restored.resolve(session('new-author'))
    await expect(login).resolves.toBe(true)
    expect(store.userId).toBe('new-author')
  })
})
