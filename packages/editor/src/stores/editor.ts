import { acceptHMRUpdate, defineStore } from 'pinia'

export const useEditorStore = defineStore('editor', () => {
  const delayTime = ref(0)

  // 被解析后的 HTML
  const parsedHtml = ref('')
  // 被解析后的语法树
  const parsedTokens = ref<any[]>([])

  return {
    delayTime,

    parsedHtml,
    parsedTokens,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot))
