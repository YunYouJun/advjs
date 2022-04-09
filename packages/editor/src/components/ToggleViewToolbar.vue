<script lang="ts" setup>
import type { OutputType } from '../stores/editor'
import { useEditorStore } from '../stores/editor'
import IconVideoChatLine from '~icons/ri/video-chat-line'
import IconHtml5Line from '~icons/ri/html5-line'
import IconFileTextLine from '~icons/ri/file-text-line'
import IconMarkdownLine from '~icons/ri/markdown-line'

const editorStore = useEditorStore()

const parserItems: { title: string; value: OutputType; icon: string }[] = [
  {
    title: 'Markdown Preview',
    value: 'preview',
    icon: IconFileTextLine,
  },
  {
    title: 'ADV Lexer',
    value: 'adv',
    icon: IconVideoChatLine,
  },
  {
    title: 'HTML Source',
    value: 'html',
    icon: IconHtml5Line,
  },
  {
    title: 'markdown-it AST',
    value: 'markdown-it',
    icon: IconMarkdownLine,
  },
]
</script>

<template>
  <div>
    <button
      v-for="(item, i) in parserItems"
      :key="i"
      class="icon-btn rounded-full p-2 focus:outline-none"
      m="x-1"
      hover="shadow"
      text="sm"
      :title="item.title"
      :class="[
        editorStore.options.outputType === item.value ? 'bg-black text-white shadow' : ''
      ]"
      @click="editorStore.options.outputType = item.value"
    >
      <component :is="item.icon" />
    </button>
  </div>
</template>
