<template>
  <div class="containers" grid="~ cols-2 gap-1">
    <div class="container flex flex-col" p="1">
      <MarkdownEditor />
    </div>

    <div class="container flex flex-col" p="1">
      <div class="toolbar flex justify-between" m="b-2">
        <span
          id="responseTime"
          class="shadow flex justify-center items-center"
          text="sm"
          p="x-2 y-1"
          :title="t('parser.response_time')"
        >
          <i-ri-timer-line />
          : {{ editorStore.delayTime }} ms
        </span>

        <select id="outputType" v-model="outputType" class="text-sm shadow bg-transparent">
          <option
            v-for="(parser, i) in parserItems"
            :key="i"
            :value="parser.value"
          >
            {{ parser.name }}
          </option>
        </select>
      </div>

      <div id="outputContent" class="border rounded" text="left" h="full">
        <div v-show="outputType === 'html'" class="prose p-4" v-html="editorStore.parsedHtml"></div>
        <PreviewEditor v-show="outputType === 'markdown-it'" :content="editorStore.parsedTokens" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditorStore } from '../stores/editor'
const { t } = useI18n()
const editorStore = useEditorStore()

// import * as advParser from '@advjs/parser'
// use markdown-it-adv replace
export type OutputType = 'adv' | 'html' | 'markdown-it'

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
    name: 'markdown-it',
    value: 'markdown-it',
  },
]

// 输出类型
const outputType = ref<OutputType>('markdown-it')
</script>

<style>
/* for demo html */
pre {
  overflow: auto;
  white-space: pre-wrap;
}

/* for layout */
.container {
  height: calc(100vh - 100px);
}
</style>
