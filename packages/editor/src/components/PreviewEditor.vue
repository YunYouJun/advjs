<template>
  <div id="preview-container" ref="container" class="w-full h-full" text="sm"></div>
</template>

<script lang="ts" setup>
import { isClient } from '@vueuse/core'
import type * as m from 'monaco-editor'
import setupMonaco from '../setup/monaco'

const container = ref<HTMLElement | null>()

// ref store is slow, and stuck
let editor: m.editor.IStandaloneCodeEditor
const props = defineProps<{ content: Object }>()

async function init() {
  const { initOutputEditor } = await setupMonaco()

  nextTick(() => {
    if (container.value) {
      editor = initOutputEditor(container.value)
      self.outputEditor = editor
      editor.setValue(JSON.stringify(props.content, null, 2))
    }
  })

  watch(() => props.content, () => {
    editor.setValue(JSON.stringify(props.content, null, 2))
  })
}

if (isClient)
  init()
</script>
