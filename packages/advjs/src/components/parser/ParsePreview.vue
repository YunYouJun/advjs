<template>
  <div class="containers flex" grid="~ cols-2 gap-1">
    <div class="container flex flex-col" p="1">
      <div class="toolbar flex justify-between" m="b-2">
        <button id="permalink" class="btn" text="sm">
          Permalink
        </button>
        <button
          id="clear"
          class="btn"
          bg="red-500 hover:red-700"
          text="sm"
          @click="inputText = ''"
        >
          Clear
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
        >Response Time: {{ delayTime }} ms</span>

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

      <div id="outputContent" class="border rounded" text="left" h="full" v-html="outputContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
// import marked from 'marked'
// import Prism from 'prismjs'
// import 'prismjs/components/prism-json'
// import * as advParser from '@advjs/parser'
// use markdown-it-adv replace

export type OutputType = 'adv' | 'html' | 'marked'

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
    name: 'marked',
    value: 'marked',
  },
  {
    name: 'markdown-it',
    value: 'markdown-it',
  },
]

// const path = ref('/md/test.adv.md')
// // loading status
// const loading = ref(true)

// 是否正在输入中文
const isInputZh = ref(false)
// 输出类型
const outputType = ref<OutputType>('adv')

// 输入的 markdown 文本
const inputText = ref('')
const delayTime = ref(0)
const highlightAdv = ref('')
const highlightLexer = ref('')
const html = ref('')

// 输出的内容
const outputContent = ref('')
const noPadding = ref(true)

// onMounted(async () => {
//   const markdown = await getTestMarkdown(path.value)
//   if (markdown) {
//     loading.value = false
//     handleInputText(markdown)
//   }
// })

// function getTestMarkdown(path: string) {
//   return fetch(path)
//     .then((res) => {
//       return res.text()
//     })
//     .then((text) => {
//       if (!inputText.value) inputText.value = text

//       return text
//     })
// }

function handleInputText(markdown: string) {
  // 中文输入法时不获取值，输入完再执行
  if (isInputZh.value) return

  const startTime = new Date().valueOf()
  const lexed = marked.lexer(markdown)

  highlightLexer.value = highlight(lexed)
  highlightAdv.value = highlight(advParser.parse(lexed))
  html.value = marked.parse(markdown)

  setOutputContent(outputType.value)

  const endTime = new Date().valueOf()
  delayTime.value = endTime - startTime
  return delayTime.value
}

// function highlight(json: any) {
//   const highlightCode = Prism.highlight(
//     JSON.stringify(json, null, 2),
//     Prism.languages.json,
//     'json',
//   )
//   return `<pre class="language-json"><code>${highlightCode}</code></pre>`
// }

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
    case 'marked':
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
  overflow: scroll;
}

/* for layout */
.containers {
  height: calc(100vh - 100px);
}

#outputContent pre[class*="language-"] {
  margin: 0;
}
</style>
