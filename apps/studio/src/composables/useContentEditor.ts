import type { AudioFormData, ChapterFormData, LocationFormData, SceneFormData } from '@advjs/parser'
import type { AdvCharacter } from '@advjs/types'
import type { ContentType } from '../utils/contentFormMarkdown'
import type { IFileSystem } from '../utils/fs'
import type { StudioContentSource } from '../utils/projectContentMutation'
import type { ContentSaveContext, SaveResult } from './useContentSave'
import { computed, ref, shallowRef, watch } from 'vue'
import { parseContentFormMarkdown, stringifyContentFormMarkdown } from '../utils/contentFormMarkdown'
import { readStudioContentSource } from '../utils/projectContentMutation'
import { getCurrentProjectId } from '../utils/projectScope'

export type { ContentType } from '../utils/contentFormMarkdown'
export type EditorMode = 'create' | 'edit'
const ID_RE = /^[\w-]+$/
const DRAFT_PREFIX = 'advjs-studio-draft-'

/** Draft state and opened source are scoped together; neither is a shared project fact. */
export function useContentEditor<T extends AdvCharacter | SceneFormData | ChapterFormData | AudioFormData | LocationFormData>(
  contentType: ContentType,
  createDefault: () => T,
  options: { getFs: () => IFileSystem | null },
) {
  const isOpen = shallowRef(false)
  const mode = shallowRef<EditorMode>('create')
  const formData = ref<T>(createDefault()) as { value: T }
  const originalId = shallowRef('')
  const hasDraft = shallowRef(false)
  const source = shallowRef<StudioContentSource>()
  const markdown = shallowRef('')
  const markdownError = shallowRef('')
  const activeTab = shallowRef<'form' | 'markdown' | 'ai'>('form')
  let markdownReady = false
  let projectedForm = ''
  const draftKey = computed(() => `${DRAFT_PREFIX}${getCurrentProjectId()}-${contentType}`)
  let epoch = 0
  let active: { fs: IFileSystem | null, projectId: string, token: object, epoch: number } | undefined
  let activeDraftKey = ''
  const clone = (data: T): T => JSON.parse(JSON.stringify(data))

  function filename() {
    return 'filename' in formData.value ? formData.value.filename : ''
  }
  function resetMarkdown(raw?: string) {
    markdownReady = raw !== undefined
    markdown.value = raw ?? ''
    markdownError.value = ''
    projectedForm = JSON.stringify(formData.value)
    activeTab.value = 'form'
  }
  function syncToMarkdown() {
    // An incomplete raw draft must be repaired in Markdown, never replaced by old fields.
    if (markdownError.value || (markdownReady && projectedForm === JSON.stringify(formData.value)))
      return
    try {
      markdown.value = stringifyContentFormMarkdown(contentType, formData.value, markdownReady ? markdown.value : source.value?.content ?? undefined)
      markdownReady = true
      projectedForm = JSON.stringify(formData.value)
    }
    catch (error) {
      markdownError.value = error instanceof Error ? error.message : String(error)
    }
  }
  function updateMarkdown(raw: string) {
    // Monaco also emits for programmatic setValue; don't reparse our own form projection.
    if (markdownReady && raw === markdown.value)
      return
    markdown.value = raw
    markdownReady = true
    try {
      formData.value = parseContentFormMarkdown(contentType, raw, filename()) as T
      projectedForm = JSON.stringify(formData.value)
      markdownError.value = ''
    }
    catch (error) {
      markdownError.value = error instanceof Error ? error.message : String(error)
    }
    saveDraft()
  }

  function begin() {
    epoch += 1
    active = { fs: options.getFs(), projectId: getCurrentProjectId(), token: {}, epoch }
    activeDraftKey = draftKey.value
  }
  function refreshDraftFlag() {
    try {
      hasDraft.value = Boolean(localStorage.getItem(draftKey.value))
    }
    catch {
      hasDraft.value = false
    }
  }
  function removeDraft(key: string) {
    try {
      localStorage.removeItem(key)
    }
    catch {}
    refreshDraftFlag()
  }
  function saveDraft() {
    if (!active)
      return
    try {
      localStorage.setItem(activeDraftKey, JSON.stringify({
        schemaVersion: 1,
        projectId: active.projectId,
        mode: mode.value,
        originalId: originalId.value,
        data: formData.value,
        markdown: markdownReady ? markdown.value : undefined,
        activeTab: activeTab.value,
        source: source.value ? { path: source.value.path, content: source.value.content } : undefined,
        timestamp: Date.now(),
      }))
      refreshDraftFlag()
    }
    catch {}
  }
  function clearDraft() {
    removeDraft(draftKey.value)
  }
  watch(draftKey, refreshDraftFlag, { immediate: true })
  watch([formData, activeTab], () => {
    if (isOpen.value)
      saveDraft()
  }, { deep: true })

  function openCreate() {
    begin()
    source.value = undefined
    mode.value = 'create'
    originalId.value = ''
    formData.value = clone(createDefault())
    resetMarkdown()
    isOpen.value = true
  }
  function openEdit(data: T, opened?: StudioContentSource) {
    begin()
    source.value = opened
    mode.value = 'edit'
    formData.value = clone(data)
    originalId.value = 'id' in data ? data.id : 'filename' in data ? data.filename : ''
    resetMarkdown(opened?.content ?? undefined)
    isOpen.value = true
  }
  async function openFile(path: string): Promise<T> {
    const token = ++epoch
    const fs = options.getFs()
    const projectId = getCurrentProjectId()
    if (!fs)
      throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    const assertCurrent = () => {
      if (epoch !== token || options.getFs() !== fs || getCurrentProjectId() !== projectId)
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    }
    const opened = await readStudioContentSource(fs, path, assertCurrent)
    if (opened.content === null)
      throw new Error('ADV_STUDIO_CONTENT_MISSING')
    const data = parseContentFormMarkdown(contentType, opened.content, path.split('/').pop()!.replace(/\.adv\.md$/, ''))
    assertCurrent()
    openEdit(data as T, opened)
    return formData.value
  }
  function saveContext(): ContentSaveContext {
    syncToMarkdown()
    const session = active
    return { source: source.value, markdown: markdownReady ? markdown.value : undefined, session: session?.token, assertCurrent() {
      if (!session?.fs || active !== session || epoch !== session.epoch || options.getFs() !== session.fs || getCurrentProjectId() !== session.projectId)
        throw new Error('ADV_STUDIO_CONTENT_SCOPE_CHANGED')
    } }
  }
  function restoreDraft(): boolean {
    try {
      const raw = localStorage.getItem(draftKey.value)
      if (!raw)
        return false
      const draft = JSON.parse(raw)
      if (!['create', 'edit'].includes(draft.mode) || !draft.data || typeof draft.data !== 'object' || !Number.isSafeInteger(draft.timestamp)
        || Date.now() - draft.timestamp > 7 * 24 * 60 * 60 * 1000 || (draft.projectId !== undefined && draft.projectId !== getCurrentProjectId())) {
        clearDraft()
        return false
      }
      begin()
      mode.value = draft.mode
      originalId.value = typeof draft.originalId === 'string' ? draft.originalId : ''
      formData.value = clone(draft.data)
      const fs = options.getFs()
      source.value = fs && typeof draft.source?.path === 'string' && typeof draft.source.content === 'string'
        ? Object.freeze({ fs, path: draft.source.path, content: draft.source.content })
        : undefined
      resetMarkdown(typeof draft.markdown === 'string' ? draft.markdown : source.value?.content ?? undefined)
      if (markdownReady) {
        try {
          projectedForm = JSON.stringify(parseContentFormMarkdown(contentType, markdown.value, filename()))
        }
        catch (error) {
          markdownError.value = error instanceof Error ? error.message : String(error)
        }
      }
      activeTab.value = markdownError.value || draft.activeTab === 'markdown' ? 'markdown' : 'form'
      isOpen.value = true
      return true
    }
    catch {
      clearDraft()
      return false
    }
  }
  function close() {
    if (isOpen.value)
      saveDraft()
    isOpen.value = false
  }
  /** Keep a newer draft open, but advance its source to the exact text that actually committed. */
  function onSaved(result: SaveResult): boolean {
    if (!result.success || !result.source || !result.savedId || !active || result.session !== active.token)
      return false
    try {
      saveContext().assertCurrent?.()
    }
    catch {
      return false
    }
    source.value = result.source
    mode.value = 'edit'
    originalId.value = result.savedId
    if (JSON.stringify(formData.value) !== result.submittedData || (result.submittedMarkdown !== undefined && markdown.value !== result.submittedMarkdown)) {
      saveDraft()
      return false
    }
    isOpen.value = false
    removeDraft(activeDraftKey)
    return true
  }

  function validate(): string[] {
    const errors: string[] = []
    if (markdownError.value)
      errors.push(`Markdown: ${markdownError.value}`)
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

  return { isOpen, mode, formData, originalId, hasDraft, markdown, markdownError, activeTab, syncToMarkdown, updateMarkdown, openCreate, openEdit, openFile, saveContext, restoreDraft, close, onSaved, clearDraft, validate }
}
