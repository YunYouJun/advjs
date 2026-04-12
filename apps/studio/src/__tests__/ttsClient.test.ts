import type { TtsProvider } from '../utils/ttsClient'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getTtsProvider,
  listTtsProviders,
  registerTtsProvider,
  ttsStop,
} from '../utils/ttsClient'

describe('ttsClient registry', () => {
  it('lists built-in providers', () => {
    const providers = listTtsProviders()
    const ids = providers.map(p => p.id)
    expect(ids).toContain('web-speech')
    expect(ids).toContain('openai')
    expect(ids).toContain('doubao')
    expect(ids).toContain('custom')
  })

  it('gets provider by id', () => {
    const openai = getTtsProvider('openai')
    expect(openai).toBeDefined()
    expect(openai!.name).toBe('OpenAI TTS')
    expect(openai!.canGenerateBlob).toBe(true)
    expect(openai!.needsKey).toBe(true)
  })

  it('returns undefined for unknown provider', () => {
    expect(getTtsProvider('nonexistent')).toBeUndefined()
  })

  it('web-speech provider does not generate blobs', () => {
    const ws = getTtsProvider('web-speech')
    expect(ws).toBeDefined()
    expect(ws!.canGenerateBlob).toBe(false)
    expect(ws!.needsKey).toBe(false)
  })

  it('registers a custom provider', () => {
    const custom: TtsProvider = {
      id: 'test-provider',
      name: 'Test',
      needsKey: false,
      canGenerateBlob: true,
      generate: async () => new Blob(['test'], { type: 'audio/mp3' }),
    }
    registerTtsProvider(custom)
    expect(getTtsProvider('test-provider')).toBe(custom)
  })
})

describe('openai TTS generate', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls /audio/speech endpoint with correct params', async () => {
    const mockBlob = new Blob(['fake-audio'], { type: 'audio/mp3' })
    const mockResponse = {
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    }
    vi.mocked(fetch).mockResolvedValue(mockResponse as any)

    const provider = getTtsProvider('openai')!
    const blob = await provider.generate!({
      text: 'Hello world',
      voice: 'nova',
      model: 'tts-1',
      speed: 1.0,
      apiKey: 'sk-test',
      baseURL: 'https://api.openai.com/v1',
    })

    expect(fetch).toHaveBeenCalledOnce()
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/audio/speech')
    expect(options?.method).toBe('POST')

    const body = JSON.parse(options?.body as string)
    expect(body.model).toBe('tts-1')
    expect(body.input).toBe('Hello world')
    expect(body.voice).toBe('nova')
    expect(body.speed).toBe(1.0)

    expect(blob).toBe(mockBlob)
  })

  it('throws TtsError on 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as any)

    const provider = getTtsProvider('openai')!
    await expect(
      provider.generate!({
        text: 'test',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1.0,
        apiKey: 'bad-key',
        baseURL: 'https://api.openai.com/v1',
      }),
    ).rejects.toThrow('Invalid API key')
  })

  it('throws TtsError on 429', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    } as any)

    const provider = getTtsProvider('openai')!
    await expect(
      provider.generate!({
        text: 'test',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1.0,
        apiKey: 'sk-test',
        baseURL: 'https://api.openai.com/v1',
      }),
    ).rejects.toThrow('Rate limit')
  })
})

describe('ttsStop', () => {
  it('does not throw when nothing is playing', () => {
    expect(() => ttsStop()).not.toThrow()
  })
})
