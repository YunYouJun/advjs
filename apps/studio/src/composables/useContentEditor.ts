import type { AdvCharacter } from '@advjs/types'
import type { AudioFormData } from '../utils/audioMd'
import type { ChapterFormData } from '../utils/chapterMd'
import type { LocationFormData } from '../utils/locationMd'
import type { SceneFormData } from '../utils/sceneMd'
import { computed, ref, watch } from 'vue'
import { getCurrentProjectId } from '../utils/projectScope'

export type ContentType = 'character' | 'scene' | 'chapter' | 'audio' | 'location'
export type EditorMode = 'create' | 'edit'

const ID_RE = /^[\w-]+$/
const DRAFT_PREFIX = 'advjs-studio-draft-'

/**
 * Generic content editor state machine
 * Manages form state, mode, validation, and local draft persistence
 */
export function useContentEditor<T extends AdvCharacter | SceneFormData | ChapterFormData | AudioFormData | LocationFormData>(
  contentType: ContentType,
  createDefault: () => T,
) {
  const isOpen = ref(false)
  const mode = ref<EditorMode>('create')
  const formData = ref<T>(createDefault()) as { value: T }
  const originalId = ref<string>('')
  const hasDraft = ref(false)

  const draftKey = computed(() => `${DRAFT_PREFIX}${getCurrentProjectId()}-${contentType}`)

  // --- Draft persistence ---

  function saveDraft() {
    try {
      const draft = {
        mode: mode.value,
        originalId: originalId.value,
        data: formData.value,
        timestamp: Date.now(),
      }
      localStorage.setItem(draftKey.value, JSON.stringify(draft))
    }
    catch {
      // Storage full or not available
    }
  }

  function loadDraft(): boolean {
    try {
      const raw = localStorage.getItem(draftKey.value)
      if (!raw)
        return false

      const draft = JSON.parse(raw) as {
        mode: EditorMode
        originalId: string
        data: T
        timestamp: number
      }

      // Discard drafts older than 7 days
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - draft.timestamp > SEVEN_DAYS) {
        clearDraft()
        return false
      }

      mode.value = draft.mode
      originalId.value = draft.originalId
      formData.value = draft.data
      return true
    }
    catch {
      clearDraft()
      return false
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(draftKey.value)
    }
    catch {
      // ignore
    }
    hasDraft.value = false
  }

  // Check for existing draft on initialization
  hasDraft.value = !!localStorage.getItem(draftKey.value)

  // Auto-save draft when formData changes while editor is open
  watch(formData, () => {
    if (isOpen.value) {
      saveDraft()
    }
  }, { deep: true })

  // --- Editor lifecycle ---

  function openCreate() {
    mode.value = 'create'
    formData.value = createDefault()
    originalId.value = ''
    isOpen.value = true
  }

  function openEdit(data: T) {
    mode.value = 'edit'
    formData.value = { ...data }
    if ('id' in data) {
      originalId.value = (data as any).id
    }
    else if ('filename' in data) {
      originalId.value = (data as any).filename
    }
    isOpen.value = true
  }

  /** Restore from local draft (returns true if draft was loaded) */
  function restoreDraft(): boolean {
    const loaded = loadDraft()
    if (loaded) {
      isOpen.value = true
    }
    return loaded
  }

  function close() {
    isOpen.value = false
    // Keep draft on close (user might have accidentally closed)
  }

  /** Call after successful save to clear the draft */
  function onSaved() {
    clearDraft()
  }

  function validate(): string[] {
    const errors: string[] = []
    const data = formData.value

    if (contentType === 'character') {
      const char = data as AdvCharacter
      if (!char.id?.trim())
        errors.push('ID is required')
      if (!char.name?.trim())
        errors.push('Name is required')
      if (char.id && !ID_RE.test(char.id))
        errors.push('ID must contain only letters, numbers, hyphens, and underscores')
    }
    else if (contentType === 'scene') {
      const scene = data as SceneFormData
      if (!scene.id?.trim())
        errors.push('ID is required')
      if (scene.id && !ID_RE.test(scene.id))
        errors.push('ID must contain only letters, numbers, hyphens, and underscores')
    }
    else if (contentType === 'chapter') {
      const chapter = data as ChapterFormData
      if (!chapter.filename?.trim())
        errors.push('Filename is required')
      if (chapter.filename && !ID_RE.test(chapter.filename.replace('.adv.md', '')))
        errors.push('Filename must contain only letters, numbers, hyphens, and underscores')
    }
    else if (contentType === 'audio') {
      const audio = data as AudioFormData
      if (!audio.name?.trim())
        errors.push('Name is required')
    }
    else if (contentType === 'location') {
      const location = data as LocationFormData
      if (!location.id?.trim())
        errors.push('ID is required')
      if (location.id && !ID_RE.test(location.id))
        errors.push('ID must contain only letters, numbers, hyphens, and underscores')
    }

    return errors
  }

  return {
    isOpen,
    mode,
    formData,
    originalId,
    hasDraft,
    openCreate,
    openEdit,
    restoreDraft,
    close,
    onSaved,
    clearDraft,
    validate,
  }
}
