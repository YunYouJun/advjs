import { isAnonymousSession } from '@yunlefun/sso'

type UnknownRecord = Record<string, unknown>

export interface AuthenticatedCloudbaseSession {
  accessToken: string
  expiresAt?: number
  refreshToken?: string
  user: CloudbaseV3User
}

export interface CloudbaseV3User {
  id: string
  displayName?: string
  email?: string
  name?: string
  phone?: string
  phone_number?: string
  picture?: string
  username?: string
  [key: string]: unknown
}

export interface CloudbaseSessionAuth {
  getSession: () => Promise<unknown>
  refreshSession?: (refreshToken?: string) => Promise<unknown>
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function responseData(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value))
    return undefined
  if (value.error)
    return undefined
  return isRecord(value.data) ? value.data : undefined
}

export function getCloudbaseResponseError(value: unknown): Error | undefined {
  if (!isRecord(value) || !value.error)
    return undefined
  if (value.error instanceof Error)
    return value.error
  if (typeof value.error === 'string')
    return new Error(value.error)
  if (isRecord(value.error)) {
    const message = value.error.message ?? value.error.error_description ?? value.error.msg
    if (typeof message === 'string' && message)
      return new Error(message)
  }
  return new Error('CloudBase authentication failed.')
}

function secondsToMilliseconds(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    return undefined
  return value < 10_000_000_000 ? value * 1_000 : value
}

export function parseAuthenticatedCloudbaseSession(value: unknown): AuthenticatedCloudbaseSession | undefined {
  const data = responseData(value)
  const session = data && isRecord(data.session) ? data.session : undefined
  if (!session || isAnonymousSession(session) || !isRecord(session.user))
    return undefined
  const userId = session.user.id
  const accessToken = session.access_token
  if (typeof userId !== 'string' || !userId || typeof accessToken !== 'string' || !accessToken)
    return undefined
  const refreshToken = typeof session.refresh_token === 'string' && session.refresh_token
    ? session.refresh_token
    : undefined
  const expiresAt = secondsToMilliseconds(session.expires_at ?? session.expires)
  return {
    accessToken,
    ...(expiresAt ? { expiresAt } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    user: {
      ...session.user,
      id: userId,
    } as CloudbaseV3User,
  }
}

export async function readAuthenticatedCloudbaseSession(
  auth: CloudbaseSessionAuth,
): Promise<AuthenticatedCloudbaseSession | undefined> {
  const response = await auth.getSession()
  const error = getCloudbaseResponseError(response)
  if (error)
    throw error
  return parseAuthenticatedCloudbaseSession(response)
}

export async function getRuntimeAccessToken(
  auth: CloudbaseSessionAuth,
  options: { now?: () => number, refreshSkewMs?: number } = {},
): Promise<string> {
  const now = options.now ?? Date.now
  const refreshSkewMs = options.refreshSkewMs ?? 60_000
  let session = await readAuthenticatedCloudbaseSession(auth)
  if (!session)
    throw new Error('A non-anonymous CloudBase session is required.')

  const expiring = session.expiresAt !== undefined && session.expiresAt <= now() + refreshSkewMs
  if (!expiring)
    return session.accessToken
  if (!auth.refreshSession)
    throw new Error('The CloudBase session cannot be refreshed.')

  const refreshResponse = await auth.refreshSession(session.refreshToken)
  const refreshError = getCloudbaseResponseError(refreshResponse)
  if (refreshError)
    throw refreshError
  const refreshed = parseAuthenticatedCloudbaseSession(refreshResponse)
  if (!refreshed)
    throw new Error('The CloudBase session has expired. Sign in again.')
  session = refreshed
  return session.accessToken
}

export function createRuntimeAccessTokenGetter(
  auth: CloudbaseSessionAuth,
  options: { now?: () => number, onSessionExpired: () => void, refreshSkewMs?: number },
): () => Promise<string> {
  return async () => {
    try {
      return await getRuntimeAccessToken(auth, options)
    }
    catch (error) {
      options.onSessionExpired()
      throw error
    }
  }
}
