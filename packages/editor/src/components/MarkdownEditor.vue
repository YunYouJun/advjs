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
</template>

<script lang="ts" setup>
import type * as m from 'monaco-editor'
import { isClient } from '@vueuse/core'
import setupMonaco from '../setup/monaco'
import { useEditorStore } from '../stores/editor'

const { t } = useI18n()

const editorStore = useEditorStore()

const mdPath = ref('https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/advjs/public/md/test.adv.md')
// loading status
const loading = ref(true)

const inputEditor = ref<HTMLElement | null>()
let editor: m.editor.IStandaloneCodeEditor

async function fetchMarkdown() {
  loading.value = true

  const text = await fetch(mdPath.value)
    .then((res) => {
      return res.text()
    })

  if (!editor.getValue() && text)
    editor.setValue(text)
    // editorStore.handleInputText(text)

  loading.value = false
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
    if (inputEditor.value) {
      editor = initInputEditor(inputEditor.value)
      editor.onDidChangeModelContent(() => {
        const inputText = editor.getValue()
        editorStore.setInputText(inputText)
      })
    }

    fetchMarkdown()
  })
}

if (isClient)
  init()
</script>
