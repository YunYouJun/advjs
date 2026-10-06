import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/** In-memory editor drafts; successful disk writes are the only save boundary. */
export const useProjectDrafts = defineStore('editor:project-drafts', () => {
  const entries = ref(new Map<string, { dirty: boolean, save: () => Promise<boolean> }>())
  const dirty = computed(() => [...entries.value.values()].some(entry => entry.dirty))
  function register(id: string, entry: { dirty: boolean, save: () => Promise<boolean> }) {
    entries.value.set(id, entry)
  }
  function remove(id: string) {
    entries.value.delete(id)
  }
  async function saveAll() {
    for (const entry of entries.value.values()) {
      if (entry.dirty && !await entry.save())
        return false
    }
    const files = useFileStore()
    if (files.isDirty)
      await files.saveOpenedFile()
    return true
  }
  return { dirty, register, remove, saveAll }
})
