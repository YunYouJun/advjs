import { describe, expect, it, vi } from 'vitest'
import { AiApiError, chatCompletionsURL, isAllowedBaseURL, streamChat, testAiConnection } from '../../../packages/ai/src/chat'

const endpoint = { baseURL: 'https://api.example.test/v1/', apiKey: 'sk-test', model: 'm' }

function sse(chunks: string[], { hang = false } = {}): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(encoder.encode(chunk))
      if (!hang)
        controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

const delta = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

async function collect(stream: AsyncGenerator<string>) {
  let text = ''
  for await (const part of stream)
    text += part
  return text
}

describe('streamChat', () => {
  it('posts to chat/completions and joins deltas split across chunks', async () => {
    const usage = vi.fn()
    const fetch = vi.fn(async () => {
      const event = delta('世界')
      return sse([delta('你好，'), event.slice(0, 10), event.slice(10), `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 3 } })}\n\n`, 'data: [DONE]\n\n'])
    })
    const text = await collect(streamChat({ ...endpoint, messages: [{ role: 'user', content: 'hi' }], fetch, onUsage: usage }))
    expect(text).toBe('你好，世界')
    expect(usage).toHaveBeenCalledWith({ promptTokens: 12, completionTokens: 3 })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.example.test/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(JSON.parse(init.body as string)).toMatchObject({ model: 'm', stream: true })
  })

  it('classifies HTTP errors without retrying them', async () => {
    const fetch = vi.fn(async () => new Response('bad key: sk-test', { status: 401 }))
    const error = await collect(streamChat({ ...endpoint, messages: [], fetch, retries: 2 })).catch(e => e)
    expect(error).toBeInstanceOf(AiApiError)
    expect(error.type).toBe('auth')
    expect(error.message).not.toContain('sk-test')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a network failure before the first delta', async () => {
    const fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(sse([delta('ok'), 'data: [DONE]\n\n']))
    expect(await collect(streamChat({ ...endpoint, messages: [], fetch, retries: 1 }))).toBe('ok')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('times out a stream that stops sending', async () => {
    const fetch = vi.fn(async () => sse([delta('half')], { hang: true }))
    const seen: string[] = []
    const error = await (async () => {
      for await (const part of streamChat({ ...endpoint, messages: [], fetch, readTimeout: 20, retries: 1 }))
        seen.push(part)
    })().catch(e => e)
    expect(seen).toEqual(['half'])
    expect(error.type).toBe('timeout')
    // Text was already yielded, so the request is not repeated.
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('reports a cancelled request as aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetch = vi.fn(async () => {
      throw new DOMException('Aborted', 'AbortError')
    })
    const error = await collect(streamChat({ ...endpoint, messages: [], fetch, signal: controller.signal })).catch(e => e)
    expect(error.type).toBe('aborted')
  })
})

describe('testAiConnection', () => {
  it('passes on 200 and maps 429 to rate_limit', async () => {
    await expect(testAiConnection(endpoint, { fetch: vi.fn(async () => new Response('{}', { status: 200 })) })).resolves.toBeUndefined()
    await expect(testAiConnection(endpoint, { fetch: vi.fn(async () => new Response('', { status: 429 })) })).rejects.toMatchObject({ type: 'rate_limit' })
  })
})

describe('provider addresses', () => {
  it('builds the completions URL', () => {
    expect(chatCompletionsURL('https://api.deepseek.com/v1//')).toBe('https://api.deepseek.com/v1/chat/completions')
  })

  it('only allows HTTPS or this machine', () => {
    expect(isAllowedBaseURL('https://api.deepseek.com/v1')).toBe(true)
    expect(isAllowedBaseURL('http://localhost:11434/v1')).toBe(true)
    expect(isAllowedBaseURL('http://127.0.0.1:8080')).toBe(true)
    expect(isAllowedBaseURL('http://api.example.com/v1')).toBe(false)
    expect(isAllowedBaseURL('https://user:pass@api.example.com')).toBe(false)
    expect(isAllowedBaseURL('javascript:alert(1)')).toBe(false)
  })
})
