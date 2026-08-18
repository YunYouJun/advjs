import type { AgentErrorCode, AgentEventEnvelope } from '../core/contracts'
import { AGENT_PROTOCOL_VERSION, parseAgentEventEnvelope } from '../core/contracts'
import { runtimeError } from '../core/errors'

export type AgentAccessTokenGetter = () => Promise<string> | string
export type AgentFetch = typeof fetch

export interface ManagedAgentTransportOptions {
  baseUrl: string
  getAccessToken: AgentAccessTokenGetter
  fetch?: AgentFetch
}

interface RequestOptions {
  body?: unknown
  headers?: Readonly<Record<string, string>>
  method?: 'GET' | 'POST'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mapApiErrorCode(code: string): AgentErrorCode {
  if (code === 'AUTH_REQUIRED' || code === 'SERVICE_AUTH_REQUIRED')
    return 'unauthenticated'
  if (code === 'ORIGIN_FORBIDDEN' || code === 'FORBIDDEN')
    return 'forbidden'
  if (code === 'BETA_ACCESS_REQUIRED')
    return 'beta_access_required'
  if (code === 'RATE_LIMITED' || code === 'QUOTA_EXCEEDED')
    return 'quota_exceeded'
  if (code === 'POINTS_INSUFFICIENT')
    return 'balance_insufficient'
  if (code === 'ACTIVE_TASK_EXISTS')
    return 'concurrency_limit'
  if (code === 'PLATFORM_DAILY_LIMIT')
    return 'platform_budget_exceeded'
  if (code === 'AI_DISABLED')
    return 'capability_disabled'
  if (code.startsWith('CONTENT_BLOCKED'))
    return 'content_blocked'
  if (code === 'IDEMPOTENCY_CONFLICT' || code === 'INVALID_CURSOR')
    return 'conflict'
  if (code === 'PROTOCOL_UNSUPPORTED')
    return 'protocol_unsupported'
  if (code === 'RECONCILE_REQUIRED')
    return 'reconcile_required'
  if (
    code === 'INVALID_CAPABILITY_INPUT'
    || code === 'REQUEST_TOO_LARGE'
    || code === 'IDEMPOTENCY_KEY_REQUIRED'
    || code === 'TASK_NOT_FOUND'
    || code === 'ROUTE_NOT_FOUND'
  ) {
    return 'invalid_request'
  }
  return 'internal_error'
}

async function responsePayload(response: Response): Promise<unknown> {
  try {
    return await response.json()
  }
  catch {
    return undefined
  }
}

function apiFailure(response: Response, payload: unknown): Error {
  const source = isRecord(payload) ? payload : {}
  const error = isRecord(source.error) ? source.error : {}
  const rawCode = typeof error.code === 'string' ? error.code : `HTTP_${response.status}`
  const requestId = typeof error.requestId === 'string'
    ? error.requestId
    : response.headers.get('x-request-id') ?? undefined
  return runtimeError(
    mapApiErrorCode(rawCode),
    typeof error.message === 'string' ? error.message : 'The managed agent request failed.',
    {
      requestId,
      retryable: typeof error.retryable === 'boolean' ? error.retryable : response.status >= 500,
      status: response.status,
    },
  )
}

function successData(payload: unknown): unknown {
  if (!isRecord(payload) || payload.protocolVersion !== AGENT_PROTOCOL_VERSION || !('data' in payload)) {
    throw runtimeError(
      'protocol_unsupported',
      'The managed agent returned an unsupported response.',
    )
  }
  return payload.data
}

function parseSseFrame(
  frame: string,
  parser: (value: unknown) => AgentEventEnvelope,
): AgentEventEnvelope | undefined {
  const data: string[] = []
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':'))
      continue
    const separator = line.indexOf(':')
    const field = separator < 0 ? line : line.slice(0, separator)
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '')
    if (field === 'data')
      data.push(value)
  }
  if (data.length === 0)
    return undefined
  try {
    return parser(JSON.parse(data.join('\n')))
  }
  catch (error) {
    throw runtimeError(
      'protocol_unsupported',
      'The managed agent event stream was invalid.',
      { cause: error },
    )
  }
}

function nextFrame(buffer: string): { frame: string, rest: string } | undefined {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  const index = lf < 0 ? crlf : crlf < 0 ? lf : Math.min(lf, crlf)
  if (index < 0)
    return undefined
  const delimiterLength = buffer.startsWith('\r\n\r\n', index) ? 4 : 2
  return { frame: buffer.slice(0, index), rest: buffer.slice(index + delimiterLength) }
}

export class ManagedAgentTransport {
  readonly #baseUrl: string
  readonly #fetch: AgentFetch
  readonly #getAccessToken: AgentAccessTokenGetter

  constructor(options: ManagedAgentTransportOptions) {
    const baseUrl = options.baseUrl.trim().replace(/\/+$/, '')
    if (!/^https?:\/\//.test(baseUrl))
      throw new TypeError('Managed agent baseUrl must be an absolute HTTP URL')
    this.#baseUrl = baseUrl
    this.#fetch = options.fetch ?? fetch
    this.#getAccessToken = options.getAccessToken
  }

  async request<T>(
    path: string,
    parser: (value: unknown) => T,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.#request(path, options)
    const payload = await responsePayload(response)
    if (!response.ok)
      throw apiFailure(response, payload)
    try {
      return parser(successData(payload))
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AgentRuntimeError')
        throw error
      throw runtimeError(
        'protocol_unsupported',
        'The managed agent response did not match protocol v1.',
        { cause: error },
      )
    }
  }

  async requestRaw<T>(
    path: string,
    parser: (value: unknown) => T,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.#request(path, options)
    const payload = await responsePayload(response)
    if (!response.ok)
      throw apiFailure(response, payload)
    try {
      return parser(payload)
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AgentRuntimeError')
        throw error
      throw runtimeError(
        'protocol_unsupported',
        'The managed agent response did not match protocol v2.',
        { cause: error },
      )
    }
  }

  async* events(
    path: string,
    cursor?: string,
    parser: (value: unknown) => AgentEventEnvelope = parseAgentEventEnvelope,
  ): AsyncIterable<AgentEventEnvelope> {
    const url = new URL(this.#url(path))
    if (cursor)
      url.searchParams.set('cursor', cursor)
    const response = await this.#request(url.toString(), {
      headers: {
        accept: 'text/event-stream',
        ...(cursor ? { 'last-event-id': cursor } : {}),
      },
    })
    if (!response.ok)
      throw apiFailure(response, await responsePayload(response))
    if (!response.body) {
      throw runtimeError(
        'upstream_error',
        'The managed agent event stream was unavailable.',
        { retryable: true },
      )
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      let candidate = nextFrame(buffer)
      while (candidate) {
        buffer = candidate.rest
        const envelope = parseSseFrame(candidate.frame, parser)
        if (envelope)
          yield envelope
        candidate = nextFrame(buffer)
      }
      if (done)
        break
    }
    const finalEnvelope = parseSseFrame(buffer.trim(), parser)
    if (finalEnvelope)
      yield finalEnvelope
  }

  async #request(path: string, options: RequestOptions): Promise<Response> {
    let token: string
    try {
      token = (await this.#getAccessToken()).trim()
    }
    catch (error) {
      throw runtimeError(
        'unauthenticated',
        'Your session expired. Sign in again before starting a managed AI task.',
        { cause: error },
      )
    }
    if (!token) {
      throw runtimeError(
        'unauthenticated',
        'Sign in to use managed AI.',
      )
    }
    try {
      return await this.#fetch(this.#url(path), {
        method: options.method ?? 'GET',
        headers: {
          authorization: `Bearer ${token}`,
          ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...options.headers,
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      })
    }
    catch (error) {
      throw runtimeError(
        'upstream_error',
        'Could not reach the managed agent service.',
        { cause: error, retryable: true },
      )
    }
  }

  #url(path: string): string {
    if (/^https?:\/\//.test(path)) {
      if (!path.startsWith(`${this.#baseUrl}/`) && path !== this.#baseUrl) {
        throw runtimeError(
          'protocol_unsupported',
          'The managed agent returned an event URL outside its API boundary.',
        )
      }
      return path
    }
    return `${this.#baseUrl}/${path.replace(/^\/+/, '')}`
  }
}
