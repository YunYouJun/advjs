import { acceptHMRUpdate, defineStore } from 'pinia'
import { convertMdToAdv, mdParse } from '@advjs/parser'
import type { Root } from 'mdast'
import { mdRender } from '@advjs/parser/markdown'
import type { AdvRoot } from '@advjs/types'

export type OutputType = 'adv' | 'preview' | 'html' | 'markdown-it'

const namespace = 'advjs-editor'

export const useEditorStore = defineStore('editor', () => {
  const delayTime = ref(0)

  const mdUrl = useStorage(`${namespace}-mdUrl`, 'https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/advjs/public/md/test.adv.md')

  // 输出类型
  const outputType = useStorage<OutputType>(`${namespace}-outputType`, 'markdown-it')

  // 输入文本
  const inputText = useStorage(`${namespace}-input-text`, '')

  // 被解析后的 HTML
  const parsedHtml = ref('')
  // 被解析后的语法树
  const parsedTokens = ref<Root>()
  // 被解析后的 AdvScript 语法树
  const parsedAdv = ref<AdvRoot>()

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
    inputText.value = value
    debouncedHandleFn(value)
  }

  /**
   * 设置输出类型
   */
  async function setOutputType(type: OutputType) {
    outputType.value = type
  }

  return {
    mdUrl,

    delayTime,

    inputText,
    outputType,

    parsedHtml,
    parsedTokens,
    parsedAdv,

    handleInputText,
    setInputText,
    setOutputType,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot))
