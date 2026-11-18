import type { SsoAuthorizationResult } from '@yunlefun/sso'
import type { StudioSsoBrowser, StudioSsoSdk } from '../auth/studio-sso'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createStudioIdentityCoordinator } from '../auth/identity-coordinator'
import { STUDIO_SSO_CONFIGS } from '../auth/sso-config'
import { useAuthStore } from '../stores/useAuthStore'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}
const config = STUDIO_SSO_CONFIGS.production
function authorization(code: string): SsoAuthorizationResult {
  return { ok: true, code, issuer: config.ssoOrigin, clientId: config.clientId, scope: config.scope, redirectUri: config.redirectUri, nonce: 'fixture-nonce', codeVerifier: 'fixture-verifier' }
}
function fixture() {
  setActivePinia(createPinia())
  const mirror = useAuthStore()
  const gates = new Map<string, ReturnType<typeof deferred<void>>>()
  const calls: string[] = []
  let user: string | undefined = 'initial'
  let active = 0
  let maximum = 0
  let signOutError: Error | undefined
  let onChanged: (() => void) | undefined
  async function operation(label: string, work: () => unknown = () => undefined) {
    calls.push(label)
    active += 1
    maximum = Math.max(maximum, active)
    const gate = gates.get(label)
    gates.delete(label)
    try {
      await gate?.promise
      return work()
    }
    finally {
      active -= 1
    }
  }
  function session(id?: string) {
    return { data: { session: id ? { access_token: `fixture-token-${id}`, user: { id } } : null } }
  }
  const auth = {
    getSession: vi.fn(async () => {
      const captured = user
      await operation('read')
      return session(captured)
    }),
    refreshSession: vi.fn(async () => {
      const captured = user
      await operation('refresh')
      return session(captured)
    }),
    signInWithCustomTicket: vi.fn(async (getTicket: () => Promise<string>) => {
      const ticket = await getTicket()
      await operation(`signin:${ticket}`, () => {
        user = ticket
        onChanged?.()
      })
    }),
    signOut: vi.fn(async () => operation('signout', () => {
      if (signOutError)
        throw signOutError
      user = undefined
      onChanged?.()
    })),
  }
  const sdk: StudioSsoSdk = {
    requestHostSsoAuthorization: vi.fn(async () => authorization('latest')),
    adoptSsoCode: vi.fn(async (adoption, result) => {
      await adoption.signInWithCustomTicket(async () => result.code)
      return true
    }),
    hasSsoRedirectResult: () => false,
    consumeSsoRedirect: () => null,
    startSsoRedirect: vi.fn(async () => {}),
  }
  const values = new Map<string, string>()
  const browser: StudioSsoBrowser = {
    getHash: () => '',
    getOrigin: () => config.origin,
    now: () => 1000,
    storage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: (key) => { values.delete(key) },
    },
  }
  const navigate = vi.fn(async () => {})
  const identity = createStudioIdentityCoordinator({ auth, mirror, config, sdk, browser, navigate })
  return {
    auth,
    mirror,
    identity,
    sdk,
    calls,
    navigate,
    get maximum() { return maximum },
    get sdkUser() { return user },
    setUser(value?: string) { user = value },
    failSignOut(error?: Error) { signOutError = error },
    emitSdkChanges() {
      onChanged = () => {
        void identity.refresh()
      }
    },
    hold(label: string) {
      const gate = deferred<void>()
      gates.set(label, gate)
      return gate
    },
    async initialize() {
      await identity.initialize()
      calls.length = 0
    },
  }
}

describe('studio SDK identity operation order', () => {
  it('restores the existing session and applies a current host login', async () => {
    const f = fixture()
    await f.initialize()
    expect(f.mirror.userId).toBe('initial')
    await f.identity.synchronizeHost()
    expect(f.mirror.userId).toBe('latest')
    expect(f.calls).toEqual(['signout', 'signin:latest', 'read', 'read'])
    expect(f.maximum).toBe(1)
  })
  it('skips superseded queued intents and never adopts a delayed old authorization', async () => {
    const f = fixture()
    await f.initialize()
    const host = deferred<SsoAuthorizationResult>()
    vi.mocked(f.sdk.requestHostSsoAuthorization).mockImplementationOnce(() => host.promise)
    const first = f.identity.synchronizeHost()
    await flushPromises()
    const second = f.identity.synchronizeHost()
    const third = f.identity.synchronizeHost()
    expect(f.mirror.isLoggedIn).toBe(false)
    host.resolve(authorization('obsolete'))
    await Promise.all([first, second, third])
    expect(f.auth.signInWithCustomTicket).toHaveBeenCalledTimes(1)
    expect(f.sdk.requestHostSsoAuthorization).toHaveBeenCalledTimes(2)
    expect(f.calls.filter(value => value === 'signout')).toHaveLength(2)
    expect(f.mirror.userId).toBe('latest')
  })
  it('waits for an already started old SDK write and suppresses its auth notification', async () => {
    const f = fixture()
    await f.initialize()
    f.emitSdkChanges()
    vi.mocked(f.sdk.requestHostSsoAuthorization).mockResolvedValueOnce(authorization('old'))
    const write = f.hold('signin:old')
    const old = f.identity.synchronizeHost()
    await flushPromises()
    const latest = f.identity.synchronizeHost()
    await flushPromises()
    expect(f.calls).toEqual(['signout', 'signin:old'])
    expect(f.mirror.userId).toBeUndefined()
    write.resolve()
    await Promise.all([old, latest])
    await flushPromises()
    expect(f.maximum).toBe(1)
    expect(f.mirror.userId).toBe('latest')
    expect(f.calls.indexOf('signin:latest')).toBeGreaterThan(f.calls.indexOf('signin:old'))
  })
  it('makes logout supersede host adoption without resurrecting the old session', async () => {
    const f = fixture()
    await f.initialize()
    const host = deferred<SsoAuthorizationResult>()
    vi.mocked(f.sdk.requestHostSsoAuthorization).mockImplementationOnce(() => host.promise)
    const old = f.identity.synchronizeHost()
    await flushPromises()
    const logout = f.identity.logout()
    host.resolve(authorization('obsolete'))
    await old
    expect(await logout).toBe(true)
    expect(f.sdkUser).toBeUndefined()
    expect(f.auth.signInWithCustomTicket).not.toHaveBeenCalled()
    expect(await f.identity.refresh()).toBe(false)
    expect(f.mirror.isLoggedIn).toBe(false)
  })
  it('shares the same queue with interactive login and navigation', async () => {
    const f = fixture()
    await f.initialize()
    const write = f.hold('signin:latest')
    const login = f.identity.login('/old-project')
    await flushPromises()
    const logout = f.identity.logout()
    write.resolve()
    expect(await login).toBe('superseded')
    expect(await logout).toBe(true)
    expect(f.navigate).not.toHaveBeenCalled()
    expect(f.maximum).toBe(1)
    expect(f.mirror.isLoggedIn).toBe(false)
  })
  it('returns an interactive login result and restores its requested route', async () => {
    const f = fixture()
    await f.initialize()
    expect(await f.identity.login('/projects/current')).toBe('authenticated')
    expect(f.mirror.userId).toBe('latest')
    expect(f.navigate).toHaveBeenCalledWith('/projects/current')
  })
  it('keeps passive restoration fenced after an uncertain sign-out', async () => {
    const f = fixture()
    await f.initialize()
    f.failSignOut(new Error('uncertain signout'))
    vi.mocked(f.sdk.requestHostSsoAuthorization).mockResolvedValueOnce(null)
    await f.identity.synchronizeHost()
    expect(f.sdkUser).toBe('initial')
    expect(f.mirror.authError).toBe('uncertain signout')
    expect(await f.identity.refresh()).toBe(false)
    expect(f.mirror.isLoggedIn).toBe(false)
    f.failSignOut()
    expect(await f.identity.logout()).toBe(true)
    expect(await f.identity.refresh()).toBe(false)
    expect(f.mirror.authError).toBeUndefined()
  })
  it('accepts a verified replacement even when prior sign-out failed', async () => {
    const f = fixture()
    await f.initialize()
    f.failSignOut(new Error('uncertain signout'))
    await f.identity.synchronizeHost()
    expect(f.mirror.userId).toBe('latest')
    expect(f.mirror.authError).toBeUndefined()
  })
  it('does not let a stale host error replace a newer successful login', async () => {
    const f = fixture()
    await f.initialize()
    const host = deferred<SsoAuthorizationResult>()
    vi.mocked(f.sdk.requestHostSsoAuthorization).mockImplementationOnce(() => host.promise)
    const old = f.identity.synchronizeHost()
    await flushPromises()
    const current = f.identity.login('/current')
    host.reject(new Error('old host failure'))
    await old
    expect(await current).toBe('authenticated')
    expect(f.mirror.authError).toBeUndefined()
    expect(f.mirror.userId).toBe('latest')
    expect(f.sdk.startSsoRedirect).not.toHaveBeenCalled()
  })
  it('serializes token refresh with writes and rejects reuse of an old connection', async () => {
    const f = fixture()
    await f.initialize()
    const sessionAuth = f.identity.sessionAuth()
    const gate = f.hold('refresh')
    const token = sessionAuth.refreshSession()
    const rejection = expect(token).rejects.toThrow('superseded')
    await flushPromises()
    const current = f.identity.synchronizeHost()
    await flushPromises()
    expect(f.calls).toEqual(['refresh'])
    expect(f.mirror.isLoggedIn).toBe(false)
    gate.resolve()
    await rejection
    await current
    const reads = f.auth.getSession.mock.calls.length
    await expect(sessionAuth.getSession()).rejects.toThrow('superseded')
    expect(f.auth.getSession).toHaveBeenCalledTimes(reads)
    expect(f.maximum).toBe(1)
    expect(f.mirror.userId).toBe('latest')
  })
  it('drops a delayed passive restoration when a host change arrives', async () => {
    const f = fixture()
    await f.initialize()
    const read = f.hold('read')
    const passive = f.identity.refresh()
    await flushPromises()
    const current = f.identity.synchronizeHost()
    read.resolve()
    expect(await passive).toBe(false)
    await current
    expect(f.mirror.userId).toBe('latest')
    expect(f.maximum).toBe(1)
  })
  it('coalesces SDK notifications during a passive restore without looping', async () => {
    const f = fixture()
    await f.initialize()
    const gate = f.hold('read')
    const first = f.identity.refresh()
    await flushPromises()
    const second = f.identity.refresh()
    const third = f.identity.refresh()
    gate.resolve()
    expect(await Promise.all([first, second, third])).toEqual([true, true, true])
    await flushPromises()
    expect(f.calls).toEqual(['read'])
  })
  it('waits for a host change received during initial restoration', async () => {
    const f = fixture()
    const read = f.hold('read')
    const initialization = f.identity.initialize()
    await flushPromises()
    const host = f.identity.synchronizeHost()
    read.resolve()
    await initialization
    await host
    expect(f.mirror.userId).toBe('latest')
    expect(f.maximum).toBe(1)
  })
  it('rejects invalid redirect callbacks and cannot passively restore an old cache', async () => {
    const f = fixture()
    f.sdk.hasSsoRedirectResult = () => true
    f.sdk.consumeSsoRedirect = () => null
    await f.identity.initialize()
    expect(f.navigate).toHaveBeenCalledWith({ path: '/login', query: { ssoError: 'invalid_or_expired_callback' } })
    expect(await f.identity.refresh()).toBe(false)
    expect(f.mirror.isLoggedIn).toBe(false)
    expect(f.auth.getSession).not.toHaveBeenCalled()
  })
})
