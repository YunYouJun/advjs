<template>
  <div class="containers flex" grid="~ cols-2 gap-1">
    <div class="container flex flex-col" p="1">
      <div class="toolbar flex justify-between items-center" m="b-2">
        <button id="permalink" class="btn" text="sm">
          {{ t('parser.permalink') }}
        </button>
        <span class="text-sm shadow flex justify-center items-center" p="x-2 y-1">
          <span class="inline-flex">
            <i-ri-loader-line v-if="loading" class="animate-spin" />
            <i-ri-check-line v-else text="green-500" class="cursor-pointer" @click="fetchMarkdown" />
          </span>
          <span class="inline-flex" text="gray-500" m="l-2">{{ mdPath }}</span>
        </span>
        <button
          id="clear"
          class="btn"
          bg="red-500 hover:red-700"
          text="sm"
          @click="inputText = ''"
        >
          {{ t('parser.clear') }}
        </button>
      </div>

      <textarea
        id="inputMarkdown"
        v-model="inputText"
        class="border outline-none rounded bg-transparent focus:border-black"
        dark="border-white"
        h="full"
        p="2"
        @input="handleInputText(inputText)"
        @compositionstart="isInputZh = true"
        @compositionend="
          () => {
            isInputZh = false
            handleInputText(inputText)
          }
        "
      ></textarea>
    </div>

    <div class="container flex flex-col" p="1">
      <div class="toolbar flex justify-between" m="b-2">
        <span
          id="responseTime"
          class="shadow"
          text="sm"
          p="x-2 y-1"
        >{{ t('parser.response_time') }}: {{ delayTime }} ms</span>

        <select
          id="outputType"
          v-model="outputType"
          class="text-sm shadow bg-transparent"
          @change="setOutputContent(outputType)"
        >
          <option
            v-for="(parser, i) in parserItems"
            :key="i"
            :value="parser.value"
          >
            {{ parser.name }}
          </option>
        </select>
      </div>

      <div id="outputContent" class="border rounded overflow-auto" text="left" h="full">
        <div v-show="outputType === 'html'" class="prose p-4" v-html="outputContent"></div>
        <MonacoEditor v-show="outputType === 'markdown-it'" :content="tokens" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownIt from 'markdown-it'

const { t } = useI18n()
const md = new MarkdownIt()

// import marked from 'marked'
// import * as advParser from '@advjs/parser'
// use markdown-it-adv replace

export type OutputType = 'adv' | 'html' | 'markdown-it'

const parserItems = [
  {
    name: 'ADV Lexer',
    value: 'adv',
  },
  {
    name: 'Markdown Preview',
    value: 'html',
  },
  {
    name: 'markdown-it',
    value: 'markdown-it',
  },
]

const mdPath = ref('/md/test.adv.md')
// loading status
const loading = ref(true)

// 是否正在输入中文
const isInputZh = ref(false)
// 输出类型
const outputType = ref<OutputType>('markdown-it')

// 输入的 markdown 文本
const inputText = ref('')

const delayTime = ref(0)
const highlightAdv = ref('')
const highlightLexer = ref('')
const html = ref('')
const tokens = ref<any[]>([])

// 输出的内容
const outputContent = ref('')
const noPadding = ref(true)

async function fetchMarkdown() {
  loading.value = true
  const text = await fetch(mdPath.value)
    .then((res) => {
      return res.text()
    })

  if (!inputText.value) inputText.value = text

  if (text) {
    loading.value = false
    handleInputText(text)
  }
}

onMounted(async() => {
  fetchMarkdown()
})

/**
 * 处理输入文本
 */
function handleInputText(markdown: string) {
  // 中文输入法时不获取值，输入完再执行
  if (isInputZh.value) return

  const startTime = new Date().valueOf()
  // const lexed = marked.lexer(markdown)

  // highlightLexer.value = highlight(lexed)
  // highlightAdv.value = highlight(advParser.parse(lexed))
  html.value = md.render(markdown)
  tokens.value = md.parse(markdown, {})

  setOutputContent(outputType.value)

  const endTime = new Date().valueOf()
  delayTime.value = endTime - startTime
  return delayTime.value
}

/**
 * 设置输出内容
 */
function setOutputContent(type: OutputType) {
  switch (type) {
    case 'adv':
      outputContent.value = highlightAdv.value
      noPadding.value = true
      break
    case 'html':
      outputContent.value = html.value
      noPadding.value = false
      break
    case 'markdown-it':
      outputContent.value = highlightLexer.value
      noPadding.value = true
      break
    default:
      break
  }
}
</script>

<style>
/* for demo html */
pre {
  overflow: auto;
  white-space: pre-wrap;
}

/* for layout */
.container {
  height: calc(100vh - 100px);
}

#outputContent pre[class*="language-"] {
  margin: 0;
}
</style>
