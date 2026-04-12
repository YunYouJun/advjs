import type { WorldEvent } from '@advjs/types'
import type { CharacterDiaryEntry } from '../stores/useCharacterDiaryStore'

export interface TimelineEntry {
  id: string
  kind: 'event' | 'diary'
  date: string
  period: string
  characterId?: string
  characterIds?: string[]
  summary: string
  type?: string
  mood?: string
  createdAt: number
  source: WorldEvent | CharacterDiaryEntry
  /** Full diary content (only present when kind === 'diary') */
  diaryContent?: string
}

export const PERIOD_ORDER: Record<string, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
}

export const EVENT_TYPE_EMOJI: Record<string, string> = {
  daily: '🔵',
  social: '🟢',
  unexpected: '🟠',
  weather: '🌤️',
  manual: '📝',
}
