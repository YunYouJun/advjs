import type { SsoAuthorizationResult } from '@yunlefun/sso'
import type { StudioSsoAuth, StudioSsoBrowser, StudioSsoSdk } from '../auth/studio-sso'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STUDIO_SSO_CONFIGS } from '../auth/sso-config'
import { adoptStudioSsoFromHost, beginStudioSso, consumeStudioSsoCallback } from '../auth/studio-sso'

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
const authorization: SsoAuthorizationResult = { ok: true, code: 'c'.repeat(43), issuer: config.ssoOrigin, clientId: config.clientId, scope: config.scope, redirectUri: config.redirectUri, nonce: 'n'.repeat(32), codeVerifier: 'v'.repeat(43) }
function fixture() {
  let current = true
  const assertCurrent = () => {
    if (!current)
      throw new Error('superseded identity')
  }
  const auth: StudioSsoAuth = { getSession: vi.fn(async () => ({ data: { session: { access_token: 'fixture-token', user: { id: 'author' } } } })), signInWithCustomTicket: vi.fn(async getTicket => getTicket()) }
  const sdk: StudioSsoSdk = { requestHostSsoAuthorization: vi.fn(async () => authorization), adoptSsoCode: vi.fn(async () => true), hasSsoRedirectResult: () => true, consumeSsoRedirect: () => authorization, startSsoRedirect: vi.fn(async () => {}) }
  const values = new Map<string, string>()
  const browser: StudioSsoBrowser = {
    getHash: () => '#ylf_sso=fixture',
    getOrigin: () => config.origin,
    now: () => 1000,
    storage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value) },
      removeItem: (key) => { values.delete(key) },
    },
  }
  return {
    auth,
    sdk,
    browser,
    values,
    assertCurrent,
    invalidate: () => { current = false },
  }
}

describe('sSO authorization scope before SDK adoption', () => {
  afterEach(() => vi.useRealTimers())
  it('does not exchange a host response after that identity was replaced', async () => {
    const f = fixture()
    const host = deferred<SsoAuthorizationResult>()
    f.sdk.requestHostSsoAuthorization = () => host.promise
    const job = adoptStudioSsoFromHost(f.auth, config, { sdk: f.sdk, assertCurrent: f.assertCurrent })
    f.invalidate()
    host.resolve(authorization)
    await expect(job).rejects.toThrow('superseded')
    expect(f.sdk.adoptSsoCode).not.toHaveBeenCalled()
  })
  it('does not hand an exchanged ticket to the SDK after replacement', async () => {
    const f = fixture()
    const ticket = deferred<string>()
    const applied: string[] = []
    f.auth.signInWithCustomTicket = async (getTicket) => {
      applied.push(await getTicket())
    }
    f.sdk.adoptSsoCode = async (auth) => {
      await auth.signInWithCustomTicket(() => ticket.promise)
      return true
    }
    const job = adoptStudioSsoFromHost(f.auth, config, { sdk: f.sdk, assertCurrent: f.assertCurrent })
    await flushPromises()
    f.invalidate()
    ticket.resolve('fixture-ticket')
    await expect(job).rejects.toThrow('superseded')
    expect(applied).toEqual([])
  })
  it('does not publish or read an obsolete SDK sign-in result', async () => {
    const f = fixture()
    const adopted = deferred<boolean>()
    f.sdk.adoptSsoCode = () => adopted.promise
    const job = adoptStudioSsoFromHost(f.auth, config, { sdk: f.sdk, assertCurrent: f.assertCurrent })
    await flushPromises()
    f.invalidate()
    adopted.resolve(true)
    await expect(job).rejects.toThrow('superseded')
    expect(f.auth.getSession).not.toHaveBeenCalled()
  })
  it('does not redirect or remove a newer return path after an obsolete host error', async () => {
    const f = fixture()
    const host = deferred<SsoAuthorizationResult>()
    f.sdk.requestHostSsoAuthorization = () => host.promise
    const job = beginStudioSso(f.auth, config, '/old-project', { sdk: f.sdk, browser: f.browser, assertCurrent: f.assertCurrent })
    f.values.set('advjs-studio:sso:return-path', 'newer-return-path')
    f.invalidate()
    host.reject(new Error('Old host request failed'))
    await expect(job).rejects.toThrow('superseded')
    expect(f.sdk.startSsoRedirect).not.toHaveBeenCalled()
    expect(f.values.get('advjs-studio:sso:return-path')).toBe('newer-return-path')
  })
  it('does not accept an obsolete redirect callback adoption', async () => {
    const f = fixture()
    const adopted = deferred<boolean>()
    f.sdk.adoptSsoCode = () => adopted.promise
    const job = consumeStudioSsoCallback(f.auth, config, { sdk: f.sdk, browser: f.browser, assertCurrent: f.assertCurrent })
    f.invalidate()
    adopted.resolve(true)
    await expect(job).rejects.toThrow('superseded')
    expect(f.auth.getSession).not.toHaveBeenCalled()
  })
  it('bounds a host read and ignores its response after timeout', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const host = deferred<SsoAuthorizationResult>()
    f.sdk.requestHostSsoAuthorization = () => host.promise
    const job = adoptStudioSsoFromHost(f.auth, config, { sdk: f.sdk, assertCurrent: f.assertCurrent })
    const failure = expect(job).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await failure
    host.resolve(authorization)
    await vi.advanceTimersByTimeAsync(0)
    expect(f.sdk.adoptSsoCode).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('never hands a ticket to the SDK after the exchange read timed out', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const ticket = deferred<string>()
    const applied: string[] = []
    f.auth.signInWithCustomTicket = async (getTicket) => {
      applied.push(await getTicket())
    }
    f.sdk.adoptSsoCode = async (auth) => {
      await auth.signInWithCustomTicket(() => ticket.promise)
      return true
    }
    const job = adoptStudioSsoFromHost(f.auth, config, { sdk: f.sdk, assertCurrent: f.assertCurrent })
    const failure = expect(job).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await failure
    ticket.resolve('fixture-late-ticket')
    await vi.advanceTimersByTimeAsync(0)
    expect(applied).toEqual([])
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not abandon a session write after the ticket has been delivered', async () => {
    vi.useFakeTimers()
    const f = fixture()
    const write = deferred<void>()
    let settled = false
    f.auth.signInWithCustomTicket = async (getTicket) => {
      await getTicket()
      await write.promise
    }
    f.sdk.adoptSsoCode = async (auth) => {
      await auth.signInWithCustomTicket(async () => 'fixture-ticket')
      return true
    }
    const job = adoptStudioSsoFromHost(f.auth, config, { sdk: f.sdk, assertCurrent: f.assertCurrent }).finally(() => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(settled).toBe(false)
    expect(f.auth.getSession).not.toHaveBeenCalled()
    write.resolve()
    expect(await job).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
