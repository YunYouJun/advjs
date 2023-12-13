<script lang="ts" setup>
import type { OutputType } from '../stores/editor'
import { useEditorStore } from '../stores/editor'

const editorStore = useEditorStore()

const parserItems: { title: string, value: OutputType, icon: string }[] = [
  {
    title: 'Markdown Preview',
    value: 'preview',
    icon: 'i-ri-file-text-line',
  },
  {
    title: 'ADV Lexer',
    value: 'adv',
    icon: 'i-ri-video-chat-line',
  },
  {
    title: 'HTML Source',
    value: 'html',
    icon: 'i-ri-html5-line',
  },
  {
    title: 'markdown-it AST',
    value: 'markdown-it',
    icon: 'i-ri-markdown-line',
  },
]
</script>

<template>
  <div>
    <button
      v-for="(item, i) in parserItems"
      :key="i"
      class="icon-btn rounded-full focus:outline-none"
      m="x-1"
      hover="shadow"
      text="sm"
      :title="item.title"
      :class="[
        editorStore.options.outputType === item.value ? 'bg-black text-white shadow' : '',
      ]"
      @click="editorStore.options.outputType = item.value"
    >
      <div :class="item.icon" />
    </button>
  </div>
</template>
