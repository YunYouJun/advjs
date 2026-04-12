import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  contentHash,
  cosineSimilarity,
  generateEmbeddings,
  rankBySimilarity,
} from '../utils/embeddingClient'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0)
  })

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1)
  })

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })

  it('handles non-unit vectors', () => {
    const sim = cosineSimilarity([3, 4], [6, 8])
    expect(sim).toBeCloseTo(1) // same direction
  })
})

describe('rankBySimilarity', () => {
  it('returns top-K results sorted by score', () => {
    const query = [1, 0]
    const sections = [
      { index: 0, embedding: [0, 1] }, // orthogonal
      { index: 1, embedding: [1, 0] }, // identical
      { index: 2, embedding: [0.7, 0.7] }, // partial match
    ]
    const result = rankBySimilarity(query, sections, 2)
    expect(result).toHaveLength(2)
    expect(result[0].index).toBe(1) // best match
    expect(result[0].score).toBeCloseTo(1)
  })

  it('returns all when topK exceeds count', () => {
    const result = rankBySimilarity([1, 0], [{ index: 0, embedding: [1, 0] }], 5)
    expect(result).toHaveLength(1)
  })

  it('handles empty sections', () => {
    const result = rankBySimilarity([1, 0], [], 5)
    expect(result).toHaveLength(0)
  })
})

describe('contentHash', () => {
  it('returns string length', () => {
    expect(contentHash('hello')).toBe(5)
    expect(contentHash('')).toBe(0)
    expect(contentHash('你好世界')).toBe(4)
  })
})

describe('generateEmbeddings', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls /embeddings endpoint with correct params', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [
          { index: 0, embedding: [0.1, 0.2, 0.3] },
          { index: 1, embedding: [0.4, 0.5, 0.6] },
        ],
      }),
    } as any)

    const result = await generateEmbeddings({
      texts: ['hello', 'world'],
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
    })

    expect(fetch).toHaveBeenCalledOnce()
    const [url, opts] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/embeddings')
    const body = JSON.parse(opts?.body as string)
    expect(body.model).toBe('text-embedding-3-small')
    expect(body.input).toEqual(['hello', 'world'])

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual([0.1, 0.2, 0.3])
  })

  it('returns empty array for empty input', async () => {
    const result = await generateEmbeddings({
      texts: [],
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
    })
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws on 401', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as any)

    await expect(generateEmbeddings({
      texts: ['test'],
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'bad',
      model: 'text-embedding-3-small',
    })).rejects.toThrow('Invalid API key')
  })
})
