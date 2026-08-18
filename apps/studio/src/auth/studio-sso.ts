import type { SsoAdoptionAuth, SsoAuthorizationResult } from '@yunlefun/sso'
import type { CloudbaseSessionAuth } from './cloudbase-session'
import type { StudioSsoConfig } from './sso-config'
import {
  adoptSsoCode,
  consumeSsoRedirect,
  hasSsoRedirectResult,
  startSsoRedirect,
} from '@yunlefun/sso'
import {
  requestHostSsoAuthorization,
  SsoIdentityAdoptionError,
} from '@yunlefun/sso/browser'
import { readAuthenticatedCloudbaseSession } from './cloudbase-session'

const RETURN_PATH_KEY = 'advjs-studio:sso:return-path'
const RETURN_PATH_TTL_MS = 10 * 60_000

interface StoredReturnPath {
  createdAt: number
  path: string
}

export interface StudioSsoBrowser {
  getHash: () => string
  getOrigin: () => string
  now: () => number
  storage: Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>
}

export interface StudioSsoSdk {
  adoptSsoCode: typeof adoptSsoCode
  consumeSsoRedirect: typeof consumeSsoRedirect
  hasSsoRedirectResult: typeof hasSsoRedirectResult
  requestHostSsoAuthorization: typeof requestHostSsoAuthorization
  startSsoRedirect: typeof startSsoRedirect
}

export interface StudioSsoAuth extends CloudbaseSessionAuth, SsoAdoptionAuth {}

export type StudioSsoCallbackResult
  = | { status: 'none' }
    | { status: 'authenticated', returnPath: string }
    | { status: 'rejected', reason: string }

export type StudioSsoStartResult
  = | { status: 'authenticated', returnPath: string }
    | { status: 'redirecting' }

function defaultBrowser(): StudioSsoBrowser {
  return {
    getHash: () => window.location.hash,
    getOrigin: () => window.location.origin,
    now: Date.now,
    storage: window.sessionStorage,
  }
}

const defaultSdk: StudioSsoSdk = {
  adoptSsoCode,
  consumeSsoRedirect,
  hasSsoRedirectResult,
  requestHostSsoAuthorization,
  startSsoRedirect,
}

export function normalizeStudioReturnPath(path: string, origin: string): string {
  try {
    const url = new URL(path, origin)
    if (url.origin !== origin || url.pathname === '/login')
      return '/tabs/me'
    return `${url.pathname}${url.search}${url.hash}`
  }
  catch {
    return '/tabs/me'
  }
}

function storeReturnPath(browser: StudioSsoBrowser, path: string): void {
  const stored: StoredReturnPath = {
    createdAt: browser.now(),
    path: normalizeStudioReturnPath(path, browser.getOrigin()),
  }
  browser.storage.setItem(RETURN_PATH_KEY, JSON.stringify(stored))
}

function consumeReturnPath(browser: StudioSsoBrowser): string {
  const raw = browser.storage.getItem(RETURN_PATH_KEY)
  browser.storage.removeItem(RETURN_PATH_KEY)
  try {
    const value = JSON.parse(raw ?? '') as Partial<StoredReturnPath>
    if (typeof value.createdAt !== 'number' || value.createdAt + RETURN_PATH_TTL_MS <= browser.now())
      return '/tabs/me'
    if (typeof value.path !== 'string')
      return '/tabs/me'
    return normalizeStudioReturnPath(value.path, browser.getOrigin())
  }
  catch {
    return '/tabs/me'
  }
}

export async function beginStudioSso(
  auth: StudioSsoAuth,
  config: StudioSsoConfig,
  returnPath: string,
  options: { browser?: StudioSsoBrowser, sdk?: StudioSsoSdk } = {},
): Promise<StudioSsoStartResult> {
  const browser = options.browser ?? defaultBrowser()
  const sdk = options.sdk ?? defaultSdk
  if (browser.getOrigin() !== config.origin)
    throw new Error('This origin is not registered for ADV.JS Studio SSO.')
  storeReturnPath(browser, returnPath)

  try {
    if (await adoptStudioSsoFromHost(auth, config, { sdk, prompt: 'consent' })) {
      return {
        status: 'authenticated',
        returnPath: consumeReturnPath(browser),
      }
    }
  }
  catch (error) {
    if (isHostAuthorizationDenied(error)) {
      browser.storage.removeItem(RETURN_PATH_KEY)
      throw error
    }
    // Old or temporarily unavailable hosts fall back to the standard
    // top-level authorization flow. No host token or session is accepted.
  }

  try {
    await sdk.startSsoRedirect({
      clientId: config.clientId,
      scope: config.scope,
      redirectUri: config.redirectUri,
      ssoOrigin: config.ssoOrigin,
    })
    return { status: 'redirecting' }
  }
  catch (error) {
    browser.storage.removeItem(RETURN_PATH_KEY)
    throw error
  }
}

export async function adoptStudioSsoFromHost(
  auth: StudioSsoAuth,
  config: StudioSsoConfig,
  options: {
    prompt?: 'consent' | 'select_account'
    sdk?: StudioSsoSdk
  } = {},
): Promise<boolean> {
  const sdk = options.sdk ?? defaultSdk
  const authorization = await sdk.requestHostSsoAuthorization({
    clientId: config.clientId,
    scope: config.scope,
    redirectUri: config.redirectUri,
    ssoOrigin: config.ssoOrigin,
    ...(options.prompt ? { prompt: options.prompt } : {}),
  })
  if (!authorization)
    return false
  if (!matchesConfig(authorization, config))
    throw new SsoIdentityAdoptionError('Host authorization does not match the registered Studio client')

  const adopted = await sdk.adoptSsoCode(auth, authorization, { exchangeUrl: config.exchangeUrl })
  if (!adopted || !await readAuthenticatedCloudbaseSession(auth))
    throw new SsoIdentityAdoptionError('Host authorization did not establish a Studio session')
  return true
}

export async function consumeStudioSsoCallback(
  auth: StudioSsoAuth,
  config: StudioSsoConfig,
  options: { browser?: StudioSsoBrowser, sdk?: StudioSsoSdk } = {},
): Promise<StudioSsoCallbackResult> {
  const browser = options.browser ?? defaultBrowser()
  const sdk = options.sdk ?? defaultSdk
  const hasCallback = sdk.hasSsoRedirectResult(browser.getHash())
  if (!hasCallback)
    return { status: 'none' }
  if (browser.getOrigin() !== config.origin)
    return { status: 'rejected', reason: 'origin_not_registered' }

  const authorization = sdk.consumeSsoRedirect()
  if (!authorization)
    return { status: 'rejected', reason: 'invalid_or_expired_callback' }
  if (!authorization.ok)
    return { status: 'rejected', reason: authorization.reason }
  if (!matchesConfig(authorization, config))
    return { status: 'rejected', reason: 'client_binding_invalid' }

  try {
    const adopted = await sdk.adoptSsoCode(auth, authorization, { exchangeUrl: config.exchangeUrl })
    if (!adopted)
      return { status: 'rejected', reason: 'authorization_adoption_failed' }
    if (!await readAuthenticatedCloudbaseSession(auth))
      return { status: 'rejected', reason: 'anonymous_or_missing_session' }
    return { status: 'authenticated', returnPath: consumeReturnPath(browser) }
  }
  catch {
    return { status: 'rejected', reason: 'authorization_exchange_failed' }
  }
}

function matchesConfig(authorization: SsoAuthorizationResult, config: StudioSsoConfig): boolean {
  return authorization.clientId === config.clientId
    && authorization.issuer === config.ssoOrigin
    && authorization.redirectUri === config.redirectUri
    && authorization.scope.length === config.scope.length
    && authorization.scope.every(scope => config.scope.includes(scope))
}

function isHostAuthorizationDenied(error: unknown): boolean {
  return error instanceof SsoIdentityAdoptionError && error.reason === 'access_denied'
}
