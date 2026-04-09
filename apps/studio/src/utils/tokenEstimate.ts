/**
 * Lightweight token estimation for OpenAI-compatible models.
 *
 * Rules of thumb:
 * - English: ~4 characters per token (or ~0.75 tokens per word)
 * - Chinese/Japanese/Korean: ~1.5 tokens per character
 * - Mixed content: weighted average
 *
 * This is an approximation — real tokenization varies by model.
 * For budget-based context management, ±10% accuracy is sufficient.
 */

const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g

/**
 * Estimate the token count for a given text.
 */
export function estimateTokens(text: string): number {
  if (!text)
    return 0

  // Count CJK characters
  const cjkChars = text.match(CJK_RE)?.length ?? 0

  // Count non-CJK characters (strip CJK to get Latin/number/punctuation portion)
  const nonCjkText = text.replace(CJK_RE, '')
  const nonCjkTokens = Math.ceil(nonCjkText.length / 4)

  // CJK: ~1.5 tokens per character
  const cjkTokens = Math.ceil(cjkChars * 1.5)

  return cjkTokens + nonCjkTokens
}

/**
 * Estimate tokens for an array of chat messages.
 * Includes ~4 tokens overhead per message for role/formatting.
 */
export function estimateMessagesTokens(
  messages: Array<{ role: string, content: string }>,
): number {
  let total = 0
  for (const msg of messages) {
    total += estimateTokens(msg.content) + 4 // role + formatting overhead
  }
  return total + 3 // conversation priming tokens
}
