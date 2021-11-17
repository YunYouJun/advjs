import { acceptHMRUpdate, defineStore } from 'pinia'
import MarkdownIt from 'markdown-it'
import type * as m from 'monaco-editor'
import { convertToAdv } from 'markdown-it-adv'
import type Token from 'markdown-it/lib/token'

const md = new MarkdownIt()

export type OutputType = 'adv' | 'preview' | 'html' | 'markdown-it'

const namespace = 'advjs-editor'

export const useEditorStore = defineStore('editor', () => {
  const delayTime = ref(0)

  const mdUrl = useStorage(`${namespace}-mdUrl`, 'https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/advjs/public/md/test.adv.md')

  // 输出类型
  const outputType = useStorage<OutputType>(`${namespace}-outputType`, 'markdown-it')

  // 输入文本
  const inputText = ref('')

  // 被解析后的 HTML
  const parsedHtml = ref('')
  // 被解析后的语法树
  const parsedTokens = ref<Token[]>([])
  // 被解析后的 AdvScript 语法树
  const parsedAdv = ref<any[]>([])

  /**
   * 处理输入文本
   */
  function handleInputText(markdown: string) {
    const startTime = new Date().valueOf()

    parsedHtml.value = md.render(markdown)
    parsedTokens.value = md.parse(markdown, {})
    parsedAdv.value = convertToAdv(parsedTokens.value)

    // setOutputContent(outputType.value)
    // set output value
    self.outputEditor.setValue(JSON.stringify(parsedTokens.value))

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

    const editor = self.outputEditor as m.editor.IStandaloneCodeEditor
    const monaco = await import('monaco-editor')
    const model = editor.getModel()

    let content = ''
    if (type === 'html') {
      if (model)
        monaco.editor.setModelLanguage(model, 'html')
      content = parsedHtml.value
    }
    else if (type === 'markdown-it') {
      content = JSON.stringify(parsedTokens.value, null, 2)
      if (model)
        monaco.editor.setModelLanguage(model, 'json')
    }
    else if (type === 'adv') {
      content = JSON.stringify(parsedAdv.value, null, 2)
      if (model)
        monaco.editor.setModelLanguage(model, 'json')
    }

    editor.setValue(content)
  }

  return {
    mdUrl,

    delayTime,

    inputText,
    outputType,

    parsedHtml,
    parsedTokens,

    handleInputText,
    setInputText,
    setOutputType,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot))
