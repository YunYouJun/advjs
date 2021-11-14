<template>
  <div id="editor-container" ref="container"></div>
</template>

<script lang="ts" setup>
import type * as monaco from 'monaco-editor'
import { isDark } from '~/composables'
import setupMonaco from '~/client/app/setup/monaco'

const container = ref<HTMLElement | null>()
let editor: monaco.editor.IStandaloneCodeEditor

const props = defineProps<{ content: Object }>()

async function init() {
  const { monaco } = await setupMonaco()

  nextTick(() => {
    if (container.value) {
      editor = monaco.editor.create(container.value, {
        language: 'json',
        theme: isDark.value ? 'vs-dark' : 'vs',
        wordWrap: 'on',
      })
    }
  })

  // add resize for editor
  self.addEventListener('resize', () => {
    editor.layout()
  })

  watch(isDark, (val) => {
    monaco.editor.setTheme(val ? 'vs-dark' : 'vs')
  })

  watch(() => props.content, () => {
    editor.setValue(JSON.stringify(props.content, null, 2))
  })
}

init()
</script>

<style>
#editor-container {
  width: 100%;
  height: 100%;
}
</style>
