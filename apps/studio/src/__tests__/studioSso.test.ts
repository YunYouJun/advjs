import type cloudbase from '@cloudbase/js-sdk'
import type { SsoAuthorizationResult } from '@yunlefun/sso'
import type {
  StudioSsoAuth,
  StudioSsoBrowser,
  StudioSsoSdk,
} from '../auth/studio-sso'
import { ManagedAgentRuntime } from '@advjs/agent'
import { SsoIdentityAdoptionError } from '@yunlefun/sso/browser'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createRuntimeAccessTokenGetter,
  getRuntimeAccessToken,
  parseAuthenticatedCloudbaseSession,
} from '../auth/cloudbase-session'
import { resolveStudioSsoConfig, STUDIO_SSO_CONFIGS } from '../auth/sso-config'
import {
  adoptStudioSsoFromHost,
  beginStudioSso,
  consumeStudioSsoCallback,
  normalizeStudioReturnPath,
} from '../auth/studio-sso'
import { useAuthStore } from '../stores/useAuthStore'
import loginPageSource from '../views/LoginPage.vue?raw'

const realSession = {
  data: {
    session: {
      access_token: 'access-token-fixture',
      refresh_token: 'refresh-token-fixture',
      expires_at: 2_000_000_000,
      user: { uid: 'uid_fixture', name: 'Fixture User', is_anonymous: false },
    },
  },
}

const anonymousSession = {
  data: {
    session: {
      access_token: 'anonymous-token-fixture',
      user: { uid: 'anonymous_fixture', is_anonymous: true },
    },
  },
}

function createAuthorization(config = STUDIO_SSO_CONFIGS.production): SsoAuthorizationResult {
  return {
    ok: true,
    code: 'c'.repeat(43),
    issuer: config.ssoOrigin,
    clientId: config.clientId,
    scope: config.scope,
    redirectUri: config.redirectUri,
    nonce: 'n'.repeat(32),
    codeVerifier: 'v'.repeat(43),
  }
}

function createBrowser(config = STUDIO_SSO_CONFIGS.production): StudioSsoBrowser {
  const values = new Map<string, string>()
  return {
    getHash: () => '#ylf_sso=fixture',
    getOrigin: () => config.origin,
    now: () => 1_000,
    storage: {
      getItem: key => values.get(key) ?? null,
      removeItem: key => void values.delete(key),
      setItem: (key, value) => void values.set(key, value),
    },
  }
}

function createSdk(overrides: Partial<StudioSsoSdk> = {}): StudioSsoSdk {
  return {
    requestHostSsoAuthorization: async () => null,
    startSsoRedirect: async () => {},
    hasSsoRedirectResult: () => true,
    consumeSsoRedirect: () => createAuthorization(),
    adoptSsoCode: async () => true,
    ...overrides,
  }
}

function createAuth(
  getSession: () => Promise<unknown>,
  signInWithCustomTicket: StudioSsoAuth['signInWithCustomTicket'] = async getTicket => getTicket(),
): StudioSsoAuth {
  return {
    getSession,
    signInWithCustomTicket,
  }
}

describe('studio SSO v3 session', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('registers exact public, first-party and development fixtures for advjs-studio-web', () => {
    expect(resolveStudioSsoConfig('https://studio.advjs.org')).toMatchObject({
      appId: 'advjs-studio',
      clientId: 'advjs-studio-web',
      redirectUri: 'https://studio.advjs.org/',
      scope: ['identity:bootstrap'],
    })
    expect(resolveStudioSsoConfig('https://advjs.yunle.fun')).toMatchObject({
      appId: 'advjs-studio',
      clientId: 'advjs-studio-web',
      redirectUri: 'https://advjs.yunle.fun/',
      scope: ['identity:bootstrap'],
    })
    expect(resolveStudioSsoConfig('http://localhost:5173')).toBeUndefined()
    expect(STUDIO_SSO_CONFIGS.development.origin).toMatch(/^https:\/\/.*\.yunle\.localhost:/)
  })

  it('adopts a successful callback and restores the original same-origin page', async () => {
    const browser = createBrowser()
    const startSsoRedirect = async (options: Parameters<StudioSsoSdk['startSsoRedirect']>[0]) => {
      expect(options).toEqual({
        clientId: 'advjs-studio-web',
        scope: ['identity:bootstrap'],
        redirectUri: 'https://studio.advjs.org/',
        ssoOrigin: 'https://www.yunle.fun',
      })
    }
    await beginStudioSso(createAuth(async () => realSession), STUDIO_SSO_CONFIGS.production, '/tabs/workspace?panel=outline', {
      browser,
      sdk: createSdk({ startSsoRedirect }),
    })

    const callback = await consumeStudioSsoCallback(
      createAuth(async () => realSession),
      STUDIO_SSO_CONFIGS.production,
      { browser, sdk: createSdk() },
    )

    expect(callback).toEqual({
      status: 'authenticated',
      returnPath: '/tabs/workspace?panel=outline',
    })
  })

  it('uses the native host authorization panel before browser redirect', async () => {
    const config = STUDIO_SSO_CONFIGS.firstPartyProduction
    let redirected = false
    const result = await beginStudioSso(
      createAuth(async () => realSession),
      config,
      '/tabs/workspace?panel=outline',
      {
        browser: createBrowser(config),
        sdk: createSdk({
          requestHostSsoAuthorization: async (options) => {
            expect(options).toMatchObject({
              clientId: 'advjs-studio-web',
              prompt: 'consent',
              redirectUri: 'https://advjs.yunle.fun/',
            })
            return createAuthorization(config)
          },
          startSsoRedirect: async () => { redirected = true },
        }),
      },
    )

    expect(result).toEqual({
      status: 'authenticated',
      returnPath: '/tabs/workspace?panel=outline',
    })
    expect(redirected).toBe(false)
  })

  it('falls back to browser redirect for host protocol failures but not explicit denial', async () => {
    let redirects = 0
    const sdk = createSdk({
      requestHostSsoAuthorization: async () => { throw new Error('HOST_AUTH_FAILED') },
      startSsoRedirect: async () => { redirects += 1 },
    })
    await expect(beginStudioSso(
      createAuth(async () => realSession),
      STUDIO_SSO_CONFIGS.production,
      '/tabs/me',
      { browser: createBrowser(), sdk },
    )).resolves.toEqual({ status: 'redirecting' })
    expect(redirects).toBe(1)

    const deniedSdk = createSdk({
      requestHostSsoAuthorization: async () => {
        throw new SsoIdentityAdoptionError('denied', 'access_denied')
      },
      startSsoRedirect: async () => { redirects += 1 },
    })
    await expect(beginStudioSso(
      createAuth(async () => realSession),
      STUDIO_SSO_CONFIGS.production,
      '/tabs/me',
      { browser: createBrowser(), sdk: deniedSdk },
    )).rejects.toMatchObject({ reason: 'access_denied' })
    expect(redirects).toBe(1)
  })

  it('silently adopts a changed native host identity without redirecting', async () => {
    const config = STUDIO_SSO_CONFIGS.firstPartyProduction
    await expect(adoptStudioSsoFromHost(
      createAuth(async () => realSession),
      config,
      {
        sdk: createSdk({
          requestHostSsoAuthorization: async (options) => {
            expect(options.prompt).toBeUndefined()
            return createAuthorization(config)
          },
        }),
      },
    )).resolves.toBe(true)
  })

  it('fails closed for missing state/nonce transaction and rejected/expired exchange', async () => {
    const browser = createBrowser()
    const auth = createAuth(async () => realSession)
    await expect(consumeStudioSsoCallback(auth, STUDIO_SSO_CONFIGS.production, {
      browser,
      sdk: createSdk({ consumeSsoRedirect: () => null }),
    })).resolves.toEqual({ status: 'rejected', reason: 'invalid_or_expired_callback' })

    await expect(consumeStudioSsoCallback(auth, STUDIO_SSO_CONFIGS.production, {
      browser,
      sdk: createSdk({ adoptSsoCode: async () => { throw new Error('expired code') } }),
    })).resolves.toEqual({ status: 'rejected', reason: 'authorization_exchange_failed' })
  })

  it('rejects an anonymous session after code adoption', async () => {
    await expect(consumeStudioSsoCallback(
      createAuth(async () => anonymousSession),
      STUDIO_SSO_CONFIGS.production,
      { browser: createBrowser(), sdk: createSdk() },
    )).resolves.toEqual({ status: 'rejected', reason: 'anonymous_or_missing_session' })
  })

  it('surfaces a custom-ticket sign-in error instead of misreporting an anonymous session', async () => {
    const auth = createAuth(
      async () => anonymousSession,
      async (getTicket) => {
        await getTicket()
        return {
          data: { session: null, user: null },
          error: { message: 'custom ticket rejected' },
        }
      },
    )

    await expect(consumeStudioSsoCallback(
      auth,
      STUDIO_SSO_CONFIGS.production,
      {
        browser: createBrowser(),
        sdk: createSdk({
          adoptSsoCode: async (adoptionAuth) => {
            await adoptionAuth.signInWithCustomTicket(async () => 'ticket-fixture')
            return true
          },
        }),
      },
    )).resolves.toEqual({ status: 'rejected', reason: 'authorization_exchange_failed' })
  })

  it('uses getSession as identity source and safely restores a legacy SDK session', async () => {
    localStorage.setItem('advjs-studio:loginState', '{"stale":true}')
    const auth = createAuth(async () => realSession)
    const store = useAuthStore()

    await expect(store.restoreSession(auth as unknown as cloudbase.auth.App)).resolves.toBe(true)

    expect(store.isLoggedIn).toBe(true)
    expect(store.userInfo.uid).toBe('uid_fixture')
    expect(localStorage.getItem('advjs-studio:loginState')).toBeNull()
  })

  it('rejects anonymous session parsing and refreshes an expiring runtime token', async () => {
    expect(parseAuthenticatedCloudbaseSession(anonymousSession)).toBeUndefined()
    const auth = {
      getSession: async () => ({
        data: {
          session: {
            ...realSession.data.session,
            expires_at: 2,
          },
        },
      }),
      refreshSession: async () => ({
        data: {
          session: {
            ...realSession.data.session,
            access_token: 'refreshed-access-token',
            expires_at: 200,
          },
        },
      }),
    }

    await expect(getRuntimeAccessToken(auth, { now: () => 10_000, refreshSkewMs: 1_000 }))
      .resolves
      .toBe('refreshed-access-token')
  })

  it('terminates managed token access when refresh fails', async () => {
    let expired = false
    const getToken = createRuntimeAccessTokenGetter({
      getSession: async () => ({
        data: { session: { ...realSession.data.session, expires_at: 2 } },
      }),
      refreshSession: async () => ({ data: { session: null }, error: { message: 'expired' } }),
    }, {
      now: () => 10_000,
      onSessionExpired: () => { expired = true },
      refreshSkewMs: 1_000,
    })

    await expect(getToken()).rejects.toThrow(/expired/i)
    expect(expired).toBe(true)

    let fetched = false
    const runtime = new ManagedAgentRuntime({
      baseUrl: 'https://www.yunle.fun/account-api/ai-gateway',
      getAccessToken: getToken,
      fetch: async () => {
        fetched = true
        throw new Error('fetch must not run without a valid session')
      },
    })
    await expect(runtime.start({
      capability: 'generate-outline',
      clientRequestId: 'expired_session_fixture',
      input: {},
      locale: 'zh-CN',
      project: { id: 'project_fixture', revision: 'revision_fixture', files: {} },
    })).rejects.toMatchObject({ detail: { code: 'unauthenticated' } })
    expect(fetched).toBe(false)
  })

  it('never restores an external/login return path and removes direct SMS login from the entry', () => {
    expect(normalizeStudioReturnPath('https://evil.invalid/steal', STUDIO_SSO_CONFIGS.production.origin)).toBe('/tabs/me')
    expect(normalizeStudioReturnPath('/login', STUDIO_SSO_CONFIGS.production.origin)).toBe('/tabs/me')
    expect(loginPageSource).not.toContain('signInWithSms')
    expect(loginPageSource).not.toContain('getVerification')
    expect(loginPageSource).toContain('signInWithYunlefun')
  })
})
