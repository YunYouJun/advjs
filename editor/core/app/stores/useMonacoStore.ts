import type * as Monaco from 'monaco-editor'
import { useStorage } from '@vueuse/core'

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
  const options = ref<Monaco.editor.IStandaloneEditorConstructionOptions>({ theme: 'vs-dark' })

  return {
    language,
    fileContent,
    options,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useMonacoStore, import.meta.hot))
