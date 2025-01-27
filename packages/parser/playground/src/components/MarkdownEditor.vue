<script lang="ts" setup>
import type * as m from 'monaco-editor'
import { isClient } from '@vueuse/core'
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { mdItems } from '../config'
import setupMonaco from '../setup/monaco'

import { useEditorStore } from '../stores/editor'

const { t } = useI18n()

const editorStore = useEditorStore()

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
  <div class="toolbar flex items-center justify-between" m="b-2">
    <button id="permalink" class="btn" text="sm" :title="t('parser.permalink')">
      <div i-ri-link />
    </button>
    <VMenu placement="top">
      <button class="rounded-full shadow transition icon-btn" hover="shadow-md">
        <div v-if="loading" i-ri-loader-line class="animate-spin" />
        <div v-else i-ri-check-line text="green-500" class="cursor-pointer" @click="fetchMarkdown" />
      </button>
      <template #popper>
        <span class="inline-flex" text="black xs" :title="editorStore.options.mdUrl">{{ editorStore.options.mdUrl }}</span>
      </template>
    </VMenu>

    <select
      v-model="editorStore.options.mdUrl"
      class="bg-transparent text-sm shadow outline-none"
      p="1"
      placeholder="选择测试 Markdown"
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
      <div i-ri-delete-bin-2-line />
    </button>
  </div>
  <div
    ref="inputEditor"
    class="border rounded bg-transparent outline-none focus:border-black"
    dark="border-white"
    h="full"
    text="left"
  />
</template>
