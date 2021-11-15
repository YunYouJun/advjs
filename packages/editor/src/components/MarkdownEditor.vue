<template>
  <div class="toolbar flex justify-between items-center" m="b-2">
    <button id="permalink" class="btn" text="sm" :title="t('parser.permalink')">
      <i-ri-link />
    </button>
    <VMenu placement="top">
      <span class="text-sm shadow flex justify-center items-center" p="x-2 y-1">
        <span class="inline-flex">
          <i-ri-loader-line v-if="loading" class="animate-spin" />
          <i-ri-check-line v-else text="green-500" class="cursor-pointer" @click="fetchMarkdown" />
        </span>
      </span>
      <template #popper>
        <span class="inline-flex" text="black xs" :title="mdPath">{{ mdPath }}</span>
      </template>
    </VMenu>
    <button
      id="clear"
      class="btn"
      bg="red-500 hover:red-700"
      text="sm"
      :title="t('parser.clear')"
      @click="clearEditorValue"
    >
      <i-ri-delete-bin-2-line />
    </button>
  </div>
  <div
    ref="inputEditor"
    class="border outline-none rounded bg-transparent focus:border-black"
    dark="border-white"
    h="full"
    text="left"
  ></div>
  <!-- <textarea
        id="inputMarkdown"
        v-model="inputText"
        class="border outline-none rounded bg-transparent focus:border-black"

        @input="handleInputText(inputText)"
        @compositionstart="isInputZh = true"
        @compositionend="
          () => {
            isInputZh = false
            handleInputText(inputText)
          }
        "
  ></textarea>-->
</template>

<script lang="ts" setup>
import type * as m from 'monaco-editor'
import { isClient } from '@vueuse/core'
import MarkdownIt from 'markdown-it'
import setupMonaco from '../setup/monaco'
import { useEditorStore } from '../stores/editor'

const md = new MarkdownIt()

const { t } = useI18n()

const editorStore = useEditorStore()

const mdPath = ref('https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/advjs/public/md/test.adv.md')
// loading status
const loading = ref(true)

const inputEditor = ref<HTMLElement | null>()
let editor: m.editor.IStandaloneCodeEditor

// 输出的内容
const outputContent = ref('')
const noPadding = ref(true)

// 是否正在输入中文
// const isInputZh = ref(false)

/**
 * 处理输入文本
 */
function handleInputText(markdown: string) {
  const startTime = new Date().valueOf()

  editorStore.parsedHtml = md.render(markdown)
  editorStore.parsedTokens = md.parse(markdown, {})

  // setOutputContent(outputType.value)

  const endTime = new Date().valueOf()
  editorStore.delayTime = endTime - startTime
  return editorStore.delayTime
}

async function fetchMarkdown() {
  loading.value = true

  const text = await fetch(mdPath.value)
    .then((res) => {
      return res.text()
    })

  if (!editor.getValue())
    editor.setValue(text)

  loading.value = false

  if (text)
    handleInputText(text)
}

/**
 * 清除 Value 数值
 */
function clearEditorValue() {
  editor.setValue('')
}

async function init() {
  const { initInputEditor } = await setupMonaco()

  nextTick(() => {
    if (inputEditor.value)
      editor = initInputEditor(inputEditor.value)

    fetchMarkdown()
  })
}

if (isClient)
  init()

</script>
