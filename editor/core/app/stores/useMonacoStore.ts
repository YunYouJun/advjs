import type * as Monaco from 'monaco-editor'
import type { DesktopFilePosition } from '../types/desktop'
import type { StoryTemplateKind } from '../utils/story-templates'
import { useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

interface ChapterEditorBinding {
  canInsert: () => boolean
  insert: (kind: StoryTemplateKind, locale: string) => Promise<void>
}

export interface ProjectSourcePosition {
  path: string
  line?: number
  column?: number
}

export interface SourceEditorBinding {
  canNavigate: (path: string) => boolean
  navigate: (source: ProjectSourcePosition, isCurrent: () => boolean) => Promise<boolean>
}

export type MonacoEditorLanguage = 'json' | 'javascript' | 'typescript' | 'html' | 'css' | 'markdown' | 'plaintext'

/**
 * global monaco editor store
 */
export const useMonacoStore = defineStore('@advjs/editor:monaco', () => {
  const language = useStorage<MonacoEditorLanguage>('adv:editor:monaco-editor:language', 'plaintext')
  /**
   * monaco editor file content
   */
  const fileContent = ref<string>('')
  const positions = ref<Record<string, DesktopFilePosition>>({})
  const chapterEditor = shallowRef<ChapterEditorBinding>()
  const sourceEditor = shallowRef<SourceEditorBinding>()
  const canInsertStory = computed(() => chapterEditor.value?.canInsert() ?? false)

  function registerSourceEditor(binding: SourceEditorBinding) {
    sourceEditor.value = binding
    return () => {
      if (sourceEditor.value === binding)
        sourceEditor.value = undefined
    }
  }

  function registerChapterEditor(binding: ChapterEditorBinding) {
    chapterEditor.value = binding
    return () => {
      if (chapterEditor.value === binding)
        chapterEditor.value = undefined
    }
  }

  async function insertStory(kind: StoryTemplateKind, locale: string) {
    if (canInsertStory.value)
      await chapterEditor.value?.insert(kind, locale)
  }
  const options = ref<Monaco.editor.IStandaloneEditorConstructionOptions>({ theme: 'vs-dark' })

  return {
    language,
    fileContent,
    positions,
    canInsertStory,
    registerChapterEditor,
    sourceEditor,
    registerSourceEditor,
    insertStory,
    options,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useMonacoStore, import.meta.hot))
