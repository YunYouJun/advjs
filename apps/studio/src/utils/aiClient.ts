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
}

/**
 * Stream chat completions from an OpenAI-compatible API.
 * Yields content deltas as they arrive via SSE.
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
  } = options

  const url = `${baseURL.replace(TRAILING_SLASHES, '')}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey)
    headers.Authorization = `Bearer ${apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
    signal,
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
      const { done, value } = await reader.read()
      if (done)
        break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed === 'data: [DONE]')
          continue
        if (!trimmed.startsWith('data: '))
          continue

        try {
          const json = JSON.parse(trimmed.slice(6))
          const delta = json.choices?.[0]?.delta?.content
          if (delta)
            yield delta
        }
        catch {
          // Skip malformed JSON lines
        }
      }
    }
  }
  finally {
    reader.releaseLock()
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
