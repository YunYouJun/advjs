import type { AdvCharacter } from '@advjs/types'
import type { DbCharacterDiary } from '../utils/db'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { runAiJsonExtraction } from '../utils/aiExtraction'
import { db } from '../utils/db'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'
import { gatherCharacterPrompts } from '../utils/promptContext'

export interface CharacterDiaryEntry {
  id: string
  characterId: string
  date: string
  period: string
  content: string
  createdAt: number
  mood?: string
}

function generateId(): string {
  return `diary-${crypto.randomUUID()}`
}

export const useCharacterDiaryStore = defineStore('characterDiary', () => {
  // Map<characterId, DiaryEntry[]>
  const diaries = ref<Map<string, CharacterDiaryEntry[]>>(new Map())
  const generatingSet = ref<Set<string>>(new Set())

  // --- Persistence ---

  const { flush, init, $reset: _$reset } = useProjectPersistence({
    source: diaries,
    save: async () => {
      const pid = getCurrentProjectId()
      const rows: DbCharacterDiary[] = []
      for (const [, entries] of diaries.value) {
        for (const entry of entries) {
          rows.push({ ...entry, projectId: pid })
        }
      }
      await db.characterDiaries.bulkPut(rows)
    },
    load: async (pid) => {
      const all = await db.characterDiaries
        .where('[projectId+characterId]')
        .between([pid, ''], [pid, '\uFFFF'])
        .toArray()

      const map = new Map<string, CharacterDiaryEntry[]>()
      for (const row of all) {
        const { projectId: _, ...entry } = row
        const list = map.get(entry.characterId) || []
        list.push(entry)
        map.set(entry.characterId, list)
      }
      // Sort each character's entries by date + period (chronological order)
      for (const [id, list] of map) {
        map.set(id, list.sort((a, b) => {
          if (a.date !== b.date)
            return a.date.localeCompare(b.date)
          return a.period.localeCompare(b.period)
        }))
      }
      diaries.value = map
    },
    clear: () => {
      diaries.value = new Map()
      generatingSet.value = new Set()
    },
  })

  const $reset = _$reset

  // --- Getters ---

  function getDiaries(characterId: string): CharacterDiaryEntry[] {
    return diaries.value.get(characterId) || []
  }

  function isGenerating(characterId: string): boolean {
    return generatingSet.value.has(characterId)
  }

  // --- Mutations ---

  function addDiary(entry: CharacterDiaryEntry): void {
    const list = diaries.value.get(entry.characterId) || []
    diaries.value.set(entry.characterId, [...list, entry])
    // Immediately persist (don't wait for debounce)
    flush()
  }

  function deleteDiary(characterId: string, diaryId: string): void {
    const list = diaries.value.get(characterId) || []
    diaries.value.set(characterId, list.filter(e => e.id !== diaryId))
    // Immediately remove from Dexie to avoid ghost entries on next load
    const pid = getCurrentProjectId()
    db.characterDiaries.delete([pid, diaryId]).catch((err) => {
      console.warn('[diary] Failed to delete diary from DB:', err)
    })
  }

  // --- AI Generation ---

  /**
   * Check if a diary already exists for the given character, date, and period.
   */
  function hasDiary(characterId: string, date: string, period: string): boolean {
    const list = diaries.value.get(characterId) || []
    return list.some(d => d.date === date && d.period === period)
  }

  /**
   * Generate a diary entry for the given character using AI.
   * Returns the new entry or null if generation fails or a diary already exists for this period.
   */
  async function generateDiary(
    character: AdvCharacter,
  ): Promise<CharacterDiaryEntry | null> {
    const characterId = character.id
    if (generatingSet.value.has(characterId))
      return null

    generatingSet.value = new Set([...generatingSet.value, characterId])

    try {
      // Use dynamic import to avoid potential circular deps
      const { useWorldClockStore } = await import('./useWorldClockStore')
      const clockStore = useWorldClockStore()
      const { date, period } = clockStore.clock

      // Avoid generating duplicate diary for the same date + period
      if (hasDiary(characterId, date, period))
        return null

      const prompts = gatherCharacterPrompts(characterId)

      const recentDiaries = getDiaries(characterId).slice(-3)
      const recentDiariesText = recentDiaries.length > 0
        ? recentDiaries.map(d => `[${d.date} ${d.period}] ${d.content}`).join('\n')
        : ''

      const prompt = `You are ${character.name || characterId}, a character with the following traits:
${character.personality ? `Personality: ${character.personality}` : ''}
${character.background ? `Background: ${character.background}` : ''}
${prompts.statePrompt ? `\n${prompts.statePrompt}` : ''}
${prompts.memoryPrompt ? `\n${prompts.memoryPrompt}` : ''}
${prompts.clockPrompt ? `\n${prompts.clockPrompt}` : ''}
${prompts.eventsPrompt ? `\n${prompts.eventsPrompt}` : ''}
${recentDiariesText ? `\nRecent diary entries:\n${recentDiariesText}` : ''}

Write a short personal diary entry (2-4 sentences) from ${character.name || characterId}'s perspective for today (${date}, ${period}).
The entry should reflect their current mood, recent events, and inner thoughts. Write in first person.

Return JSON: { "content": "diary text here", "mood": "optional mood word" }`

      const result = await runAiJsonExtraction(
        { prompt, maxTokens: 300, temperature: 0.8 },
        (raw) => {
          if (typeof raw.content !== 'string' || raw.content.length < 5)
            throw new Error('invalid')
          return {
            content: raw.content as string,
            mood: typeof raw.mood === 'string' ? raw.mood : undefined,
          }
        },
        1,
      )

      if (!result)
        return null

      const entry: CharacterDiaryEntry = {
        id: generateId(),
        characterId,
        date,
        period,
        content: result.content,
        createdAt: Date.now(),
        mood: result.mood,
      }

      addDiary(entry)
      return entry
    }
    catch {
      return null
    }
    finally {
      const next = new Set(generatingSet.value)
      next.delete(characterId)
      generatingSet.value = next
    }
  }

  return {
    diaries,
    getDiaries,
    isGenerating,
    hasDiary,
    generateDiary,
    addDiary,
    deleteDiary,
    flush,
    init,
    $reset,
  }
})
