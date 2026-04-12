/**
 * Embedding client for knowledge base vector retrieval (V2).
 *
 * Uses OpenAI-compatible `/v1/embeddings` API for generating text embeddings.
 * Compatible with: OpenAI, SiliconFlow, and any OpenAI-compatible endpoint.
 *
 * Vectors are cached in IndexedDB per section to avoid redundant API calls.
 */

const TRAILING_SLASHES = /\/+$/

export interface EmbeddingOptions {
  texts: string[]
  baseURL: string
  apiKey: string
  model: string
  signal?: AbortSignal
}

/**
 * Generate embeddings for an array of texts via OpenAI-compatible API.
 * Returns one embedding vector per input text.
 */
export async function generateEmbeddings(options: EmbeddingOptions): Promise<number[][]> {
  const { texts, baseURL, apiKey, model, signal } = options

  if (texts.length === 0)
    return []

  const url = `${baseURL.replace(TRAILING_SLASHES, '')}/embeddings`

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
      input: texts,
    }),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    if (response.status === 401)
      throw new EmbeddingError('Invalid API key for embedding service.', 'auth')
    if (response.status === 429)
      throw new EmbeddingError('Embedding rate limit exceeded. Please wait.', 'rate_limit')
    throw new EmbeddingError(
      `Embedding API error ${response.status}: ${errorText || response.statusText}`,
      'api_error',
    )
  }

  const json = await response.json()
  const data = json.data as Array<{ embedding: number[], index: number }>

  // Sort by index to match input order
  data.sort((a, b) => a.index - b.index)

  return data.map(d => d.embedding)
}

/**
 * Cosine similarity between two vectors.
 * Returns value in [-1, 1] where 1 = identical direction.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0)
    return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0)
    return 0

  return dotProduct / denominator
}

/**
 * Rank sections by similarity to a query embedding.
 * Returns top-K results sorted by descending similarity score.
 */
export function rankBySimilarity(
  queryEmbedding: number[],
  sectionEmbeddings: Array<{ index: number, embedding: number[] }>,
  topK: number,
): Array<{ index: number, score: number }> {
  const scored = sectionEmbeddings
    .map(se => ({
      index: se.index,
      score: cosineSimilarity(queryEmbedding, se.embedding),
    }))
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, topK)
}

/**
 * FNV-1a content hash for change detection.
 * Lightweight 32-bit hash — sufficient for detecting edits in cached embeddings.
 */
export function contentHash(text: string): number {
  let hash = 2166136261 >>> 0
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = (hash * 16777619) >>> 0
  }
  return hash
}

// --- Embedding provider presets ---

export interface EmbeddingProviderPreset {
  id: string
  name: string
  baseURL: string
  models: string[]
  needsKey: boolean
}

export const EMBEDDING_PROVIDERS: EmbeddingProviderPreset[] = [
  {
    id: 'same',
    name: 'Same as Chat',
    baseURL: '',
    models: [],
    needsKey: false,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseURL: 'https://api.openai.com/v1',
    models: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
    needsKey: true,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    models: ['BAAI/bge-large-zh-v1.5', 'BAAI/bge-m3'],
    needsKey: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    baseURL: '',
    models: [],
    needsKey: false,
  },
]

// --- Error type ---

export type EmbeddingErrorType = 'auth' | 'rate_limit' | 'api_error' | 'network'

export class EmbeddingError extends Error {
  type: EmbeddingErrorType

  constructor(message: string, type: EmbeddingErrorType) {
    super(message)
    this.name = 'EmbeddingError'
    this.type = type
  }
}
