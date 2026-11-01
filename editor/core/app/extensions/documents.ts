import type { EditorDocument } from '@advjs/editor-sdk'
import { computed, shallowReactive } from 'vue'

/** Plugin documents are independent of the current ADV project and survive project switches. */
export function createEditorDocumentRegistry() {
  const entries = shallowReactive(new Map<string, { owner: string, document: EditorDocument }>())
  let pending: Promise<boolean> | undefined
  const dirty = computed(() => [...entries.values()].some(entry => entry.document.dirty.value))
  function hasDirty(owner: string) {
    return [...entries.values()].some(entry => entry.owner === owner && entry.document.dirty.value)
  }
  function register(owner: string, id: string, document: EditorDocument) {
    if (!/^[a-z][a-z0-9.-]*$/u.test(id))
      throw new Error('Invalid plugin document ID')
    const key = `${owner}/${id}`
    if (entries.has(key))
      throw new Error(`Duplicate plugin document: ${key}`)
    const entry = { owner, document }
    entries.set(key, entry)
    return () => {
      if (entries.get(key) === entry)
        entries.delete(key)
    }
  }
  async function save() {
    for (const [key, entry] of [...entries]) {
      if (entries.get(key) !== entry)
        return false
      if (entry.document.dirty.value && (!await entry.document.save() || entries.get(key) !== entry || entry.document.dirty.value))
        return false
    }
    return !dirty.value
  }
  function saveAll() {
    pending ??= save().finally(() => {
      pending = undefined
    })
    return pending
  }
  return { dirty, hasDirty, register, saveAll }
}
