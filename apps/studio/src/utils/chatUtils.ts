/**
 * Shared utilities for AI chat features.
 */

/** Strip markdown code fences from AI responses (e.g. ```json\n...\n```) */
export const CODE_FENCE_START_RE = /^```(?:json)?\n?/
export const CODE_FENCE_END_RE = /\n?```$/

/**
 * Map of mood keyword → emoji.
 * Used in CharacterCard and CharacterChatPage.
 */
const MOOD_EMOJI_MAP: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  curious: '🤔',
  worried: '😟',
  excited: '🤩',
  calm: '😌',
  neutral: '😐',
  shy: '😳',
  amused: '😄',
  surprised: '😲',
  loving: '🥰',
  thoughtful: '🤨',
  playful: '😜',
  tired: '😴',
  fearful: '😨',
}

/**
 * Returns the emoji for a given mood keyword.
 * Falls back to '😐' if unknown.
 */
export function getMoodEmoji(mood: string): string {
  return MOOD_EMOJI_MAP[mood] || '😐'
}

/**
 * Map of knowledge domain keyword → emoji.
 * Matching is case-insensitive substring match.
 * Used in CharacterCard and KnowledgeManageModal.
 */
const DOMAIN_ICON_MAP: Array<[string, string]> = [
  ['法律', '⚖️'],
  ['law', '⚖️'],
  ['医学', '🏥'],
  ['medicine', '🏥'],
  ['medical', '🏥'],
  ['心理', '🧠'],
  ['psychology', '🧠'],
  ['金融', '💰'],
  ['finance', '💰'],
  ['科技', '💻'],
  ['technology', '💻'],
  ['tech', '💻'],
  ['教育', '📚'],
  ['education', '📚'],
]

/**
 * Returns the emoji icon for a given knowledge domain string.
 * Falls back to '🎓' if no match.
 */
export function getDomainIcon(domain: string): string {
  const lower = domain.toLowerCase()
  for (const [key, icon] of DOMAIN_ICON_MAP) {
    if (lower.includes(key))
      return icon
  }
  return '🎓'
}
