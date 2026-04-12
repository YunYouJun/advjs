import { describe, expect, it } from 'vitest'
import { estimateMessagesTokens, estimateTokens } from '../utils/tokenEstimate'

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('returns 0 for null-ish input', () => {
    // @ts-expect-error testing runtime guard
    expect(estimateTokens(null)).toBe(0)
    // @ts-expect-error testing runtime guard
    expect(estimateTokens(undefined)).toBe(0)
  })

  it('estimates pure English text (~4 chars per token)', () => {
    const text = 'Hello world, this is a test message.'
    const tokens = estimateTokens(text)
    // 35 chars / 4 ≈ 9 tokens
    expect(tokens).toBeGreaterThanOrEqual(8)
    expect(tokens).toBeLessThanOrEqual(12)
  })

  it('estimates pure Chinese text (~1.5 tokens per char)', () => {
    const text = '你好世界这是测试'
    const tokens = estimateTokens(text)
    // 8 CJK chars × 1.5 = 12 tokens
    expect(tokens).toBe(12)
  })

  it('estimates mixed Chinese/English text', () => {
    const text = 'Hello你好World世界'
    const tokens = estimateTokens(text)
    // 4 CJK chars × 1.5 = 6; 10 Latin chars / 4 = 3 → ~9
    expect(tokens).toBeGreaterThanOrEqual(7)
    expect(tokens).toBeLessThanOrEqual(12)
  })

  it('handles Japanese/Korean characters', () => {
    const text = 'こんにちは世界'
    const tokens = estimateTokens(text)
    // 7 CJK chars × 1.5 = 10.5 → 11
    expect(tokens).toBeGreaterThanOrEqual(10)
  })

  it('handles whitespace-only text', () => {
    const text = '   \n\t  '
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThanOrEqual(1)
  })
})

describe('estimateMessagesTokens', () => {
  it('returns priming tokens for empty array', () => {
    expect(estimateMessagesTokens([])).toBe(3)
  })

  it('adds overhead per message', () => {
    const messages = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]
    const tokens = estimateMessagesTokens(messages)
    // Each message: content tokens + 4 overhead; plus 3 priming
    // "Hi" ≈ 1 token + 4 = 5; "Hello!" ≈ 2 tokens + 4 = 6; + 3 = 14
    expect(tokens).toBeGreaterThanOrEqual(10)
    expect(tokens).toBeLessThanOrEqual(20)
  })

  it('handles messages with Chinese content', () => {
    const messages = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！我是AI助手。' },
    ]
    const tokens = estimateMessagesTokens(messages)
    expect(tokens).toBeGreaterThan(10)
  })
})
