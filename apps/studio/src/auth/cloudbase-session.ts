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
  user_metadata?: {
    avatarUrl?: string
    name?: string
    nickName?: string
    username?: string
    [key: string]: unknown
  }
  username?: string
  [key: string]: unknown
}

export interface CloudbaseSessionAuth {
  getSession: () => Promise<unknown>
  getUser?: () => Promise<unknown>
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

function parseCloudbaseV3User(value: unknown): CloudbaseV3User | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id)
    return undefined
  return {
    ...value,
    id: value.id,
    user_metadata: isRecord(value.user_metadata) ? value.user_metadata : undefined,
  }
}

export function parseAuthenticatedCloudbaseSession(value: unknown): AuthenticatedCloudbaseSession | undefined {
  const data = responseData(value)
  const session = data && isRecord(data.session) ? data.session : undefined
  if (!session || isAnonymousSession(session))
    return undefined
  const user = parseCloudbaseV3User(session.user)
  const accessToken = session.access_token
  if (!user || typeof accessToken !== 'string' || !accessToken)
    return undefined
  const refreshToken = typeof session.refresh_token === 'string' && session.refresh_token
    ? session.refresh_token
    : undefined
  const expiresAt = secondsToMilliseconds(session.expires_at ?? session.expires)
  return {
    accessToken,
    ...(expiresAt ? { expiresAt } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    user,
  }
}

export async function readAuthenticatedCloudbaseSession(
  auth: CloudbaseSessionAuth,
  options: { refreshUser?: boolean } = {},
): Promise<AuthenticatedCloudbaseSession | undefined> {
  const response = await auth.getSession()
  const error = getCloudbaseResponseError(response)
  if (error)
    throw error
  const session = parseAuthenticatedCloudbaseSession(response)
  if (!session || !options.refreshUser || !auth.getUser)
    return session

  const userResponse = await auth.getUser()
  if (getCloudbaseResponseError(userResponse))
    return session
  const data = responseData(userResponse)
  const user = parseCloudbaseV3User(data?.user)
  if (!user || user.id !== session.user.id)
    return session

  return {
    ...session,
    user: {
      ...session.user,
      ...user,
      id: session.user.id,
    },
  }
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
