import type { CompileDiagnostic } from '@advjs/core'
import type { AdvAst, RuntimeProgram } from '@advjs/types'
import type { Root as MdRoot } from 'mdast'
import { compileMarkdownProgram, ns } from '@advjs/core'
import { convertMdToAdv, mdParse, mdRender } from '@advjs/parser'

import { useDebounceFn, useStorage } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export type OutputType = 'adv' | 'runtime' | 'diagnostics' | 'preview' | 'html' | 'markdown-it'

export const useEditorStore = defineStore('editor', () => {
  const delayTime = ref(0)
  const options = useStorage<{
    mdUrl: string
    outputType: OutputType
    inputText: string
  }>(ns('editor:options'), {
    mdUrl:
      '/examples/demo/starter/index.adv.md',
    /**
     * 输出类型
     */
    outputType: 'markdown-it',
    /**
     * 输入文本
     */
    inputText: '',
  })

  // 被解析后的 HTML
  const parsedHtml = ref('')
  // 被解析后的语法树
  const parsedTokens = ref<MdRoot>()
  // 被解析后的 AdvScript 语法树
  const parsedAdv = ref<AdvAst.Root>()
  const runtimeProgram = ref<RuntimeProgram>()
  const runtimeDiagnostics = ref<CompileDiagnostic[]>([])

  /**
   * 处理输入文本
   */
  async function handleInputText(markdown: string) {
    const startTime = new Date().valueOf()

    // parsedHtml.value = md.render(markdown)
    parsedTokens.value = await mdParse(markdown)
    parsedAdv.value = convertMdToAdv(parsedTokens.value)
    parsedHtml.value = await mdRender(markdown)
    const compiled = await compileMarkdownProgram({
      id: 'parser-playground',
      chapters: [{
        id: 'chapter-1',
        title: 'Playground',
        content: markdown,
        sourcePath: 'playground.adv.md',
      }],
    })
    runtimeProgram.value = compiled.program
    runtimeDiagnostics.value = compiled.diagnostics

    const endTime = new Date().valueOf()
    delayTime.value = endTime - startTime
  }

  // 防抖
  const debouncedHandleFn = useDebounceFn((value) => {
    handleInputText(value)
  }, 200)

  /**
   * 设置输入文本
   * @param value
   */
  function setInputText(value: string) {
    options.value.inputText = value
    debouncedHandleFn(value)
  }

  return {
    options,

    delayTime,

    parsedHtml,
    parsedTokens,
    parsedAdv,
    runtimeProgram,
    runtimeDiagnostics,

    handleInputText,
    setInputText,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot))
