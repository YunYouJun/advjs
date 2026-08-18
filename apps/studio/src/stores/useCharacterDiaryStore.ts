import type { AdvCharacter } from '@advjs/types'
import type { DbCharacterDiary } from '../utils/db'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '../utils/db'
import { useProjectPersistence } from '../utils/projectPersistence'
import { getCurrentProjectId } from '../utils/projectScope'

export interface CharacterDiaryEntry {
  id: string
  characterId: string
  date: string
  period: string
  content: string
  createdAt: number
  mood?: string
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

  /** Managed diary generation is not registered yet and fails closed. */
  async function generateDiary(
    _character: AdvCharacter,
  ): Promise<CharacterDiaryEntry | null> {
    return null
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
