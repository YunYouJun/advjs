<script lang="ts" setup>
import { isClient } from '@vueuse/core'
import type * as m from 'monaco-editor'
import { nextTick, ref, watch } from 'vue'
import setupMonaco from '../setup/monaco'

const props = defineProps<{ content?: string; type: 'html' | 'json' }>()

const container = ref<HTMLElement | null>()

// ref store is slow, and stuck
let editor: m.editor.IStandaloneCodeEditor
async function init() {
  const { monaco, initOutputEditor } = await setupMonaco()

  nextTick(() => {
    if (container.value) {
      editor = initOutputEditor(container.value)
      self.outputEditor = editor
      if (props.content)
        editor.setValue(props.content)
      if (props.type) {
        const model = editor.getModel()
        if (model)
          monaco.editor.setModelLanguage(model, props.type)
      }
    }
  })

  watch(() => props.content, () => {
    if (props.content)
      editor.setValue(props.content)
  })

  watch(() => props.type, () => {
    if (props.type) {
      const model = editor.getModel()
      if (model)
        monaco.editor.setModelLanguage(model, props.type)
    }
  })
}

if (isClient)
  init()
</script>

<template>
  <div id="preview-container" ref="container" class="w-full h-full" text="sm" />
</template>
