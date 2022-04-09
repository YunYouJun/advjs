<script lang="ts" setup>
import type * as m from 'monaco-editor'
import { isClient } from '@vueuse/core'
import setupMonaco from '../setup/monaco'
import { useEditorStore } from '../stores/editor'

const { t } = useI18n()

const editorStore = useEditorStore()

const mdItems = [
  {
    name: 'test.adv.md',
    url: 'https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/advjs/public/md/test.adv.md',
  }, {
    name: '小城之春.fountain（节选）',
    url: 'https://raw.githubusercontent.com/YunYouJun/advjs/main/packages/examples/%E5%B0%8F%E5%9F%8E%E4%B9%8B%E6%98%A5.fountain',
  },
  {
    name: '雷雨（节选）',
    url: 'https://cdn.jsdelivr.net/gh/YunYouJun/advjs/packages/examples/%E9%9B%B7%E9%9B%A8.adv.md',
  },
]

// loading status
const loading = ref(false)

const inputEditor = ref<HTMLElement | null>()
let editor: m.editor.IStandaloneCodeEditor

async function fetchMarkdown() {
  loading.value = true

  const text = await fetch(editorStore.options.mdUrl)
    .then((res) => {
      return res.text()
    })

  if (editor.getValue() !== text)
    editor.setValue(text)

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

    if (!editorStore.options.inputText)
      fetchMarkdown()
    else
      editor.setValue(editorStore.options.inputText)
  })
}

if (isClient)
  init()
</script>

<template>
  <div class="toolbar flex justify-between items-center" m="b-2">
    <button id="permalink" class="btn" text="sm" :title="t('parser.permalink')">
      <i-ri-link />
    </button>
    <VMenu placement="top">
      <span class="icon-btn shadow rounded-full transition" hover="shadow-md" p="1">
        <span class="inline-flex">
          <i-ri-loader-line v-if="loading" class="animate-spin" />
          <i-ri-check-line v-else text="green-500" class="cursor-pointer" @click="fetchMarkdown" />
        </span>
      </span>
      <template #popper>
        <span class="inline-flex" text="black xs" :title="editorStore.options.mdUrl">{{ editorStore.options.mdUrl }}</span>
      </template>
    </VMenu>

    <select
      v-model="editorStore.options.mdUrl"
      class="text-sm shadow bg-transparent outline-none"
      p="1"
      @change="fetchMarkdown"
    >
      <optgroup label="选择测试 Markdown">
        <option v-for="(item, i) in mdItems" :key="i" :value="item.url">
          {{ item.name }}
        </option>
      </optgroup>
    </select>

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
  />
</template>
