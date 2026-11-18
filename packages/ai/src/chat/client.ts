const TRAILING_SLASHES = /\/+$/

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Where requests go. The key is only ever sent to `${baseURL}/chat/completions`. */
export interface ChatEndpoint {
  /** OpenAI-compatible base URL, e.g. `https://api.deepseek.com/v1` */
  baseURL: string
  apiKey: string
  model: string
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
}

export interface StreamChatOptions extends ChatEndpoint {
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  /** Aborts when no data arrives for this long, in milliseconds. `0` waits forever. @default 30000 */
  readTimeout?: number
  /** Retries network and timeout errors that happen before the first delta. @default 0 */
  retries?: number
  /** Called when the provider reports token usage (usually with the last chunk). */
  onUsage?: (usage: ChatUsage) => void
  /** Swaps the transport, for tests. @default globalThis.fetch */
  fetch?: typeof fetch
}

export type AiApiErrorType = 'auth' | 'rate_limit' | 'not_found' | 'api_error' | 'network' | 'timeout' | 'aborted'

export class AiApiError extends Error {
  type: AiApiErrorType
  status?: number

  constructor(message: string, type: AiApiErrorType, status?: number) {
    super(message)
    this.name = 'AiApiError'
    this.type = type
    this.status = status
  }
}

export function chatCompletionsURL(baseURL: string): string {
  return `${baseURL.replace(TRAILING_SLASHES, '')}/chat/completions`
}

function headersFor(apiKey: string): Record<string, string> {
  return apiKey
    ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    : { 'Content-Type': 'application/json' }
}

/** Maps an HTTP failure to an error a person can act on. The response body is not echoed back. */
function httpError(status: number): AiApiError {
  if (status === 401 || status === 403)
    return new AiApiError('The API key was rejected.', 'auth', status)
  if (status === 402)
    return new AiApiError('The account has no balance left.', 'auth', status)
  if (status === 429)
    return new AiApiError('Rate limit reached. Wait a moment and try again.', 'rate_limit', status)
  if (status === 404)
    return new AiApiError('Model or endpoint not found.', 'not_found', status)
  return new AiApiError(`The provider returned HTTP ${status}.`, 'api_error', status)
}

/** `fetch` rejects with a TypeError for DNS, offline and CORS failures alike. */
function transportError(error: unknown, signal?: AbortSignal): AiApiError {
  if (error instanceof AiApiError)
    return error
  if (signal?.aborted || (error instanceof Error && error.name === 'AbortError'))
    return new AiApiError('The request was cancelled.', 'aborted')
  return new AiApiError('Could not reach the provider. It may not allow requests from a browser.', 'network')
}

interface SseEvent {
  delta?: string
  usage?: ChatUsage
}

function parseSseLine(line: string): SseEvent | undefined {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:'))
    return
  const data = trimmed.slice(5).trim()
  if (!data || data === '[DONE]')
    return
  try {
    const json = JSON.parse(data)
    const delta = json.choices?.[0]?.delta?.content
    const usage = json.usage
    return {
      delta: typeof delta === 'string' && delta ? delta : undefined,
      usage: usage && typeof usage.prompt_tokens === 'number'
        ? { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens ?? 0 }
        : undefined,
    }
  }
  catch {
    return undefined
  }
}

async function* streamOnce(options: StreamChatOptions): AsyncGenerator<string> {
  const { signal, readTimeout = 30_000 } = options
  const request = options.fetch ?? globalThis.fetch
  let response: Response
  try {
    response = await request(chatCompletionsURL(options.baseURL), {
      method: 'POST',
      headers: headersFor(options.apiKey),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        stream: true,
      }),
      signal,
    })
  }
  catch (error) {
    throw transportError(error, signal)
  }
  if (!response.ok)
    throw httpError(response.status)

  const reader = response.body?.getReader()
  if (!reader)
    throw new AiApiError('The provider sent no response body.', 'network')

  const decoder = new TextDecoder()
  let buffer = ''
  const read = async () => {
    if (!readTimeout)
      return reader.read()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new AiApiError('The provider stopped responding.', 'timeout')), readTimeout)
        }),
      ])
    }
    finally {
      clearTimeout(timer)
    }
  }
  const handle = function* (lines: string[]) {
    for (const line of lines) {
      const event = parseSseLine(line)
      if (event?.usage)
        options.onUsage?.(event.usage)
      if (event?.delta)
        yield event.delta
    }
  }

  try {
    while (true) {
      let result: ReadableStreamReadResult<Uint8Array>
      try {
        result = await read()
      }
      catch (error) {
        throw transportError(error, signal)
      }
      if (result.done)
        break
      buffer += decoder.decode(result.value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      yield* handle(lines)
    }
    buffer += decoder.decode()
    if (buffer.trim())
      yield* handle([buffer])
  }
  finally {
    reader.cancel().catch(() => {})
  }
}

/**
 * Streams a chat completion from an OpenAI-compatible endpoint and yields content deltas.
 * Network and timeout errors are retried only while nothing has been yielded, so a consumer
 * never sees the same text twice. Auth, rate-limit and not-found errors are never retried.
 */
export async function* streamChat(options: StreamChatOptions): AsyncGenerator<string> {
  const retries = options.retries ?? 0
  for (let attempt = 0; ; attempt++) {
    let yielded = false
    try {
      for await (const delta of streamOnce(options)) {
        yielded = true
        yield delta
      }
      return
    }
    catch (error) {
      const retryable = error instanceof AiApiError && (error.type === 'network' || error.type === 'timeout')
      if (!retryable || yielded || attempt >= retries || options.signal?.aborted)
        throw error
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
    }
  }
}

/** Sends a one-token request to check the endpoint, key and model. */
export async function testAiConnection(endpoint: ChatEndpoint, options: { timeout?: number, fetch?: typeof fetch } = {}): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout ?? 15_000)
  const request = options.fetch ?? globalThis.fetch
  try {
    const response = await request(chatCompletionsURL(endpoint.baseURL), {
      method: 'POST',
      headers: headersFor(endpoint.apiKey),
      body: JSON.stringify({
        model: endpoint.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!response.ok)
      throw httpError(response.status)
  }
  catch (error) {
    const failure = transportError(error, controller.signal)
    throw failure.type === 'aborted' ? new AiApiError('The provider did not answer in time.', 'timeout') : failure
  }
  finally {
    clearTimeout(timer)
  }
}
