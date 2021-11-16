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

        <ToggleViewToolbar />
      </div>

      <div id="outputContent" class="border rounded" text="left" h="full">
        <div
          v-show="editorStore.outputType === 'preview'"
          class="prose p-4"
          v-html="editorStore.parsedHtml"
        ></div>
        <PreviewEditor
          v-show="['markdown-it', 'adv', 'html'].includes(editorStore.outputType)"
          :content="editorStore.parsedTokens"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditorStore } from '../stores/editor'
const { t } = useI18n()
const editorStore = useEditorStore()
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
