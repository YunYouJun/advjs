<template>
  <div id="main">
    <span v-show="loading" class="zi-loading-shim" title="Loading">
      <i></i><i></i><i></i>
    </span>

    <div class="containers">
      <div class="container">
        <div class="toolbar">
          <button id="permalink" class="zi-btn success small">
            Permalink
          </button>
          <button
            id="clear"
            class="zi-btn danger small"
            @click="inputText = ''"
          >
            Clear
          </button>
        </div>

        <textarea
          id="inputMarkdown"
          v-model="inputText"
          class="zi-input md-input"
          @input="handleInputText(inputText)"
          @compositionstart="isInputZh = true"
          @compositionend="
            () => {
              isInputZh = false;
              handleInputText(inputText);
            }
          "
        ></textarea>
      </div>

      <div class="container">
        <div class="toolbar">
          <button
            id="responseTime"
            class="zi-btn disabled small"
            style="color: black !important"
          >
            Response Time: {{ delayTime }} ms
          </button>

          <div class="zi-select-container mini">
            <select
              id="outputType"
              v-model="outputType"
              class="zi-select"
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
            <i class="arrow zi-icon-up"></i>
          </div>
        </div>

        <div
          id="outputContent"
          :class="['text-left', 'border', 'border-solid', 'md-input', noPadding ? 'no-padding' : '']"
          v-html="outputContent"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import marked from 'marked'
import Prism from 'prismjs'
import 'prismjs/components/prism-json'
import advParser from '@advjs/parser'

type OutputType = 'adv' | 'html' |'marked'

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

const path = ref('/md/test.adv.md')
// loading status
const loading = ref(true)
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

onMounted(async() => {
  const markdown = await getTestMarkdown(path.value)
  if (markdown) {
    loading.value = false
    handleInputText(markdown)
  }
})

function getTestMarkdown(path: string) {
  return fetch(path)
    .then((res) => {
      return res.text()
    })
    .then((text) => {
      if (!inputText.value)
        inputText.value = text

      return text
    })
}

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

function highlight(json: any) {
  const highlightCode = Prism.highlight(
    JSON.stringify(json, null, 2),
    Prism.languages.json,
    'json',
  )
  return `<pre class="language-json"><code>${highlightCode}</code></pre>`
}

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
#main {
  padding: 0 1rem;
}

/* helper */
.no-padding {
  padding: 0;
}

/* for demo html */
textarea {
  resize: none;
}

pre {
  overflow: scroll;
}

/* for layout */
.containers {
  display: flex;
  height: calc(100vh - 150px);
}

.container {
  flex-basis: 50%;
  padding: 5px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
}

#outputContent pre[class*='language-'] {
  margin: 0;
}

.md-input {
  flex-grow: 1;
  margin: 5px 0;

  overflow: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  margin: 0;
  padding: 0;
}
</style>
