import type { AiConfig } from '../stores/useAiSettingsStore'

const TRAILING_SLASHES = /\/+$/

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StreamChatOptions {
  messages: ChatMessage[]
  baseURL: string
  apiKey: string
  model: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  /** Per-chunk read timeout in milliseconds (default: 30000). 0 = no timeout. */
  readTimeout?: number
  /** Number of automatic retries on network/timeout errors (default: 0). */
  retries?: number
}

/**
 * Stream chat completions from an OpenAI-compatible API.
 * Yields content deltas as they arrive via SSE.
 *
 * - `readTimeout` (default 30s): if no new data arrives within this window, the stream is aborted.
 * - `retries` (default 0): on network/timeout errors, automatically retry up to N times.
 *   Auth and rate-limit errors are never retried.
 */
export async function* streamChat(options: StreamChatOptions): AsyncGenerator<string> {
  const {
    messages,
    baseURL,
    apiKey,
    model,
    temperature = 0.7,
    maxTokens = 2048,
    signal,
    readTimeout = 30_000,
    retries = 0,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      yield* _streamChatOnce({
        messages,
        baseURL,
        apiKey,
        model,
        temperature,
        maxTokens,
        signal,
        readTimeout,
      })
      return // success — exit retry loop
    }
    catch (err) {
      lastError = err
      // Never retry auth / rate-limit / not-found errors
      if (err instanceof AiApiError && (err.type === 'auth' || err.type === 'rate_limit' || err.type === 'not_found'))
        throw err
      // Don't retry if caller explicitly aborted
      if (signal?.aborted)
        throw err
      // If this was the last attempt, throw
      if (attempt === retries)
        throw err
      // Brief delay before retry (200ms * attempt for simple backoff)
      await new Promise(r => setTimeout(r, 200 * (attempt + 1)))
    }
  }

  // Should not reach here, but satisfy TS
  throw lastError
}

/**
 * Single-attempt stream implementation with per-chunk read timeout.
 */
async function* _streamChatOnce(opts: {
  messages: ChatMessage[]
  baseURL: string
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  signal?: AbortSignal
  readTimeout: number
}): AsyncGenerator<string> {
  const url = `${opts.baseURL.replace(TRAILING_SLASHES, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.apiKey)
    headers.Authorization = `Bearer ${opts.apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: true,
    }),
    signal: opts.signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 401)
      throw new AiApiError('Invalid API key. Please check your settings.', 'auth')
    if (response.status === 429)
      throw new AiApiError('Rate limit exceeded. Please wait and try again.', 'rate_limit')
    if (response.status === 404)
      throw new AiApiError('Model not found. Please check the model name.', 'not_found')
    throw new AiApiError(
      `API error ${response.status}: ${errorText || response.statusText}`,
      'api_error',
    )
  }

  const reader = response.body?.getReader()
  if (!reader)
    throw new AiApiError('No response body', 'network')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      // Per-chunk read timeout: if no data arrives within readTimeout, abort
      const readPromise = reader.read()
      let result: ReadableStreamReadResult<Uint8Array>

      if (opts.readTimeout > 0) {
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new AiApiError('Stream read timed out', 'timeout')), opts.readTimeout)
        })
        result = await Promise.race([readPromise, timeout])
      }
      else {
        result = await readPromise
      }

      if (result.done)
        break

      buffer += decoder.decode(result.value, { stream: true })

      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const delta = _parseSseLine(line)
        if (delta)
          yield delta
      }
    }

    // Process any remaining data in the buffer after stream ends
    if (buffer.trim()) {
      const delta = _parseSseLine(buffer)
      if (delta)
        yield delta
    }
  }
  finally {
    reader.releaseLock()
  }
}

/** Parse a single SSE line and return the content delta, or null. */
function _parseSseLine(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: '))
    return null
  try {
    const json = JSON.parse(trimmed.slice(6))
    return json.choices?.[0]?.delta?.content || null
  }
  catch {
    return null
  }
}

/**
 * Test connection to an AI provider.
 */
export async function testAiConnection(config: {
  baseURL: string
  apiKey: string
  model: string
}): Promise<boolean> {
  const url = `${config.baseURL.replace(TRAILING_SLASHES, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey)
    headers.Authorization = `Bearer ${config.apiKey}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      if (response.status === 401)
        throw new AiApiError('Invalid API key', 'auth')
      if (response.status === 429)
        throw new AiApiError('Rate limited', 'rate_limit')
      const text = await response.text().catch(() => '')
      throw new AiApiError(`HTTP ${response.status}: ${text || response.statusText}`, 'api_error')
    }

    return true
  }
  catch (err) {
    if (err instanceof AiApiError)
      throw err
    if (err instanceof DOMException && err.name === 'AbortError')
      throw new AiApiError('Connection timed out', 'timeout')
    throw new AiApiError(
      `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      'network',
    )
  }
  finally {
    clearTimeout(timeout)
  }
}

/**
 * Build the effective config values for making API calls.
 */
export function buildStreamOptions(
  messages: ChatMessage[],
  aiConfig: AiConfig,
  effectiveBaseURL: string,
  effectiveModel: string,
  signal?: AbortSignal,
): StreamChatOptions {
  return {
    messages,
    baseURL: effectiveBaseURL,
    apiKey: aiConfig.apiKey,
    model: effectiveModel,
    temperature: aiConfig.temperature,
    maxTokens: aiConfig.maxTokens,
    signal,
  }
}

export type AiApiErrorType = 'auth' | 'rate_limit' | 'not_found' | 'api_error' | 'network' | 'timeout'

export class AiApiError extends Error {
  type: AiApiErrorType

  constructor(message: string, type: AiApiErrorType) {
    super(message)
    this.name = 'AiApiError'
    this.type = type
  }
}
