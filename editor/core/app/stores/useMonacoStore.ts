import type * as Monaco from 'monaco-editor'
import { useStorage } from '@vueuse/core'

/**
 * global monaco editor store
 */
export const useMonacoStore = defineStore('@advjs/editor:monaco', () => {
  const language = useStorage('adv:editor:monaco-editor:language', '')
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
