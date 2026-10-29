import type { CloudbaseSessionAuth } from './cloudbase-session'
import type { StudioSsoConfig } from './sso-config'
import type { StudioSsoAuth, StudioSsoBrowser, StudioSsoSdk } from './studio-sso'
import { getCloudbaseResponseError } from './cloudbase-session'
import { adoptStudioSsoFromHost, beginStudioSso, consumeStudioSsoCallback } from './studio-sso'

interface IdentityAuth extends StudioSsoAuth { signOut: () => Promise<unknown> }
interface IdentityMirror {
  clearSession: () => void
  setAuthError: (message?: string) => void
  restoreSession: (auth: CloudbaseSessionAuth) => Promise<boolean>
  logout: (auth: { signOut: () => Promise<unknown> }) => Promise<boolean>
}
interface Scope { assertCurrent: () => void, resume: () => void }
type Outcome<T> = { status: 'applied', value: T } | { status: 'superseded' | 'failed' }

/** One queue owns app-initiated SDK identity operations; new intents invalidate older work immediately. */
export function createStudioIdentityCoordinator(options: {
  auth: IdentityAuth
  mirror: IdentityMirror
  config?: StudioSsoConfig
  navigate: (target: string | { path: string, query: Record<string, string> }) => Promise<unknown>
  browser?: StudioSsoBrowser
  sdk?: StudioSsoSdk
}) {
  let generation = 0
  let pending = 0
  let passiveAllowed = true
  let tail: Promise<void> = Promise.resolve()
  let refreshRequested = false
  let refreshQueued = false
  let refreshing: Promise<boolean> | undefined

  function scheduleRefresh() {
    if (refreshQueued)
      return
    refreshQueued = true
    queueMicrotask(() => {
      refreshQueued = false
      if (pending || !passiveAllowed || !refreshRequested)
        return
      if (refreshing) {
        void refreshing.then(scheduleRefresh, scheduleRefresh)
        return
      }
      refreshRequested = false
      void refresh()
    })
  }
  function finish() {
    pending -= 1
    scheduleRefresh()
  }

  function scopedAuth(assertCurrent: () => void): IdentityAuth {
    async function read<T>(action: () => Promise<T>) {
      assertCurrent()
      const value = await action()
      assertCurrent()
      return value
    }
    return {
      getSession: () => read(() => options.auth.getSession()),
      ...(options.auth.refreshSession ? { refreshSession: (token?: string) => read(() => options.auth.refreshSession!(token)) } : {}),
      ...(options.auth.getUser ? { getUser: () => read(() => options.auth.getUser!()) } : {}),
      signInWithCustomTicket: getTicket => read(() => options.auth.signInWithCustomTicket(async () => {
        assertCurrent()
        const ticket = await getTicket()
        assertCurrent()
        return ticket
      })),
      signOut: () => read(() => options.auth.signOut()),
    }
  }
  function run<T>(work: (scope: Scope, auth: IdentityAuth) => Promise<T>, recordError = false): Promise<Outcome<T>> {
    const epoch = ++generation
    pending += 1
    passiveAllowed = false
    refreshRequested = false
    options.mirror.clearSession()
    options.mirror.setAuthError()
    const assertCurrent = () => {
      if (epoch !== generation)
        throw new Error('Studio identity operation was superseded')
    }
    const scope: Scope = {
      assertCurrent,
      resume() {
        assertCurrent()
        passiveAllowed = true
      },
    }
    const job = tail.then(async (): Promise<Outcome<T>> => {
      if (epoch !== generation)
        return { status: 'superseded' }
      try {
        const value = await work(scope, scopedAuth(assertCurrent))
        assertCurrent()
        return { status: 'applied', value }
      }
      catch (error) {
        if (epoch !== generation)
          return { status: 'superseded' }
        if (!recordError)
          throw error
        options.mirror.clearSession()
        options.mirror.setAuthError(error instanceof Error ? error.message : 'Could not synchronize the host account.')
        return { status: 'failed' }
      }
    }).finally(finish)
    // Failed interactive operations remain observable to their caller; the queue still accepts the next intent.
    tail = job.then(() => undefined, () => undefined)
    return job
  }
  async function restore(scope: Scope, auth: IdentityAuth) {
    const restored = await options.mirror.restoreSession(auth)
    scope.assertCurrent()
    if (!restored)
      throw new Error('SSO authorization did not restore an authenticated Studio session')
  }
  async function refresh(): Promise<boolean> {
    if (refreshing)
      return refreshing
    if (pending || !passiveAllowed) {
      refreshRequested = true
      return false
    }
    const job = readSdk(generation, auth => options.mirror.restoreSession(auth)).catch(() => false)
    const wrapped = job.finally(() => {
      if (refreshing === wrapped)
        refreshing = undefined
      scheduleRefresh()
    })
    refreshing = wrapped
    return wrapped
  }
  function readSdk<T>(epoch: number, action: (auth: IdentityAuth) => Promise<T>): Promise<T> {
    pending += 1
    const assertCurrent = () => {
      if (epoch !== generation || !passiveAllowed)
        throw new Error('Studio identity operation was superseded')
    }
    const job = tail.then(async () => {
      assertCurrent()
      const value = await action(scopedAuth(assertCurrent))
      assertCurrent()
      return value
    }).finally(finish)
    tail = job.then(() => undefined, () => undefined)
    return job
  }
  /** Per-connection reads and token refreshes share the SDK queue with identity writes. */
  function sessionAuth() {
    const epoch = generation
    return {
      getSession: () => readSdk(epoch, auth => auth.getSession()),
      refreshSession: (token?: string) => readSdk(epoch, (auth) => {
        if (!auth.refreshSession)
          throw new Error('The CloudBase session cannot be refreshed')
        return auth.refreshSession(token)
      }),
    }
  }
  async function initialize(): Promise<void> {
    await run(async (scope, auth) => {
      const callback = options.config
        ? await consumeStudioSsoCallback(auth, options.config, { browser: options.browser, sdk: options.sdk, assertCurrent: scope.assertCurrent })
        : { status: 'none' as const }
      scope.assertCurrent()
      if (callback.status === 'rejected') {
        options.mirror.setAuthError(callback.reason)
        await options.navigate({ path: '/login', query: { ssoError: callback.reason } })
        return
      }
      if (callback.status === 'authenticated') {
        await restore(scope, auth)
        scope.resume()
        await options.navigate(callback.returnPath)
      }
      else {
        await options.mirror.restoreSession(auth)
        scope.assertCurrent()
        scope.resume()
      }
    }, true)
    // Bootstrap waits for a host change that arrived during initial restoration too.
    let observed: Promise<void>
    do {
      observed = tail
      await observed
    } while (observed !== tail)
  }
  async function login(returnPath: string): Promise<'authenticated' | 'redirecting' | 'superseded'> {
    const result = await run(async (scope, auth) => {
      if (!options.config)
        throw new Error('Studio SSO is unavailable for this origin')
      const result = await beginStudioSso(auth, options.config, returnPath, { browser: options.browser, sdk: options.sdk, assertCurrent: scope.assertCurrent })
      scope.assertCurrent()
      if (result.status === 'authenticated') {
        await restore(scope, auth)
        scope.resume()
        await options.navigate(result.returnPath)
      }
      return result.status
    })
    return result.status === 'applied' ? result.value : 'superseded'
  }
  async function logout(): Promise<boolean> {
    const result = await run(async (scope, auth) => {
      const applied = await options.mirror.logout(auth)
      scope.assertCurrent()
      if (applied)
        scope.resume()
      return applied
    })
    return result.status === 'applied' && result.value
  }
  async function synchronizeHost(): Promise<void> {
    await run(async (scope, auth) => {
      let signOutFailure: Error | undefined
      try {
        const error = getCloudbaseResponseError(await auth.signOut())
        if (error)
          signOutFailure = error
      }
      catch (error) {
        signOutFailure = error instanceof Error ? error : new Error('SDK sign-out failed during host synchronization')
      }
      scope.assertCurrent()
      const adopted = options.config
        ? await adoptStudioSsoFromHost(auth, options.config, { sdk: options.sdk, assertCurrent: scope.assertCurrent })
        : false
      scope.assertCurrent()
      if (adopted)
        await restore(scope, auth)
      else if (signOutFailure)
        throw signOutFailure
      scope.resume()
    }, true)
  }
  return { configured: Boolean(options.config), initialize, refresh, login, logout, synchronizeHost, sessionAuth }
}
export type StudioIdentityCoordinator = ReturnType<typeof createStudioIdentityCoordinator>
