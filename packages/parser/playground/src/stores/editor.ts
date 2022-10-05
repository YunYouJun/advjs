import { acceptHMRUpdate, defineStore } from 'pinia'
import type { Root as MdRoot } from 'mdast'
import type { AdvAst } from '@advjs/types'
import { ns } from '@advjs/core'

import { ref } from 'vue'
import { useDebounceFn, useStorage } from '@vueuse/core'
import { convertMdToAdv, mdParse, mdRender } from '@advjs/parser'

export type OutputType = 'adv' | 'preview' | 'html' | 'markdown-it'

export const useEditorStore = defineStore('editor', () => {
  const delayTime = ref(0)
  const options = useStorage<{
    mdUrl: string
    outputType: OutputType
    inputText: string
  }>(ns('editor:options'), {
    mdUrl:
      'https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/advjs/examples/test.adv.md',
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

  /**
   * 处理输入文本
   */
  async function handleInputText(markdown: string) {
    const startTime = new Date().valueOf()

    // parsedHtml.value = md.render(markdown)
    parsedTokens.value = await mdParse(markdown)
    parsedAdv.value = convertMdToAdv(parsedTokens.value)
    parsedHtml.value = await mdRender(markdown)

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

    handleInputText,
    setInputText,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot))
