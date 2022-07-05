<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAppStore } from '../stores/app'
import { useEditorStore } from '../stores/editor'

const { t } = useI18n()
const appStore = useAppStore()
const editorStore = useEditorStore()

const type = ref<'html' | 'json'>(editorStore.options.outputType === 'html' ? 'html' : 'json')
const content = computed(() => {
  let txt = ''
  switch (editorStore.options.outputType) {
    case 'markdown-it':
      txt = JSON.stringify(editorStore.parsedTokens, null, 2)
      // eslint-disable-next-line vue/no-side-effects-in-computed-properties
      type.value = 'json'
      break
    case 'adv':
      txt = JSON.stringify(editorStore.parsedAdv, null, 2)
      // eslint-disable-next-line vue/no-side-effects-in-computed-properties
      type.value = 'json'
      break
    case 'html':
      txt = editorStore.parsedHtml
      // eslint-disable-next-line vue/no-side-effects-in-computed-properties
      type.value = 'html'
      break
  }
  return txt
})
</script>

<template>
  <div grid="~ cols-2 gap-1 <sm:cols-1">
    <div class="container flex flex-col" p="1" :style="`order: ${appStore.leftOrder};`">
      <MarkdownEditor />
    </div>

    <div class="container flex flex-col" p="1" :style="`order: ${appStore.rightOrder};`">
      <div class="toolbar flex justify-between" m="b-2">
        <span
          id="responseTime"
          class="shadow flex justify-center items-center"
          text="sm"
          p="x-2 y-1"
          :title="t('parser.response_time')"
        >
          <div i-ri-timer-line />
          : {{ editorStore.delayTime }} ms
        </span>

        <ToggleViewToolbar />
      </div>

      <div
        id="outputContent"
        class="border rounded"
        :class="[editorStore.options.outputType === 'preview' ? 'overflow-auto' : '']"
        text="left"
        h="full"
      >
        <div v-show="editorStore.options.outputType === 'preview'" class="prose" h="full">
          <div class="p-4" v-html="editorStore.parsedHtml" />
        </div>
        <PreviewEditor
          v-show="['markdown-it', 'adv', 'html'].includes(editorStore.options.outputType)"
          :content="content"
          :type="type"
        />
      </div>
    </div>
  </div>
</template>

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
