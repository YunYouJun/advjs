<script setup lang="ts">
import type { MarkdownAudioTarget, ProjectAudioOperation } from '@advjs/core'
import type { AdvAssetManifest } from '@advjs/types'
import { patchMarkdownAudioOperations, readMarkdownAudioAtCursor } from '@advjs/core'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIToolbar from '@advjs/gui/components/toolbar/AGUIToolbar.vue'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import AEAudioOperationEditor from './AEAudioOperationEditor.vue'

const props = defineProps<{ content: string, line: number, currentContent: string, catalog?: AdvAssetManifest, zh: boolean, disabled?: boolean }>()
const emit = defineEmits<{ apply: [value: { expected: string, content: string }], close: [] }>()
const target = shallowRef<MarkdownAudioTarget>()
const operations = ref<ProjectAudioOperation[]>([])
const error = shallowRef('')
const loading = shallowRef(false)
let generation = 0
watch(() => [props.content, props.line] as const, async ([content, line]) => {
  const sequence = ++generation
  loading.value = true
  error.value = ''
  target.value = undefined
  try {
    const selected = await readMarkdownAudioAtCursor(content, line)
    if (sequence === generation) {
      target.value = selected
      operations.value = selected.operations
    }
  }
  catch (cause) {
    if (sequence === generation)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    if (sequence === generation)
      loading.value = false
  }
}, { immediate: true })
onBeforeUnmount(() => {
  generation++
})
async function apply() {
  if (!target.value || props.disabled || props.currentContent !== props.content)
    return
  const sequence = generation
  loading.value = true
  error.value = ''
  try {
    const content = await patchMarkdownAudioOperations(props.content, target.value, operations.value, props.catalog)
    if (sequence === generation)
      emit('apply', { expected: props.content, content })
  }
  catch (cause) {
    if (sequence === generation)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    if (sequence === generation)
      loading.value = false
  }
}
</script>

<template>
  <section class="inline-audio-editor" :aria-label="zh ? '源码音频属性' : 'Source audio properties'" :aria-busy="loading">
    <AGUIToolbar :items="[]" :label="zh ? '源码音频属性' : 'Source audio properties'">
      <template #before-toolbar>
        <span>{{ zh ? '场景音频' : 'Scene audio' }} · {{ target?.line ?? line }}</span>
      </template>
      <template #after-toolbar>
        <AGUIButton :disabled="!target || loading || disabled || content !== currentContent" data-testid="inline-audio-apply" @click="apply">
          {{ zh ? '应用到源码草稿' : 'Apply to source draft' }}
        </AGUIButton>
        <AGUIButton @click="emit('close')">
          {{ zh ? '关闭' : 'Close' }}
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <div class="inline-audio-fields">
      <p v-if="error" role="alert">
        {{ error }}
      </p>
      <p v-if="content !== currentContent" role="alert">
        {{ zh ? '源码草稿已变化，请关闭后重新选择。' : 'Source draft changed. Close and select again.' }}
      </p>
      <p v-if="target">
        {{ target.existing ? (zh ? '编辑此音频代码块，可通过源码撤销恢复。' : 'Edit this audio block; source undo remains available.') : (zh ? '在当前剧情块之前插入音频操作。' : 'Insert audio operations before this story block.') }}
      </p>
      <AEAudioOperationEditor v-if="target" v-model="operations" :catalog="catalog" :zh="zh" :disabled="loading || disabled" />
    </div>
  </section>
</template>

<style scoped>
.inline-audio-editor {
  flex: 0 1 40%;
  display: flex;
  flex-direction: column;
  min-height: 80px;
  min-width: 0;
  border-top: 1px solid var(--agui-c-divider);
  font-size: 12px;
  background: var(--agui-c-bg-panel);
}
.inline-audio-fields {
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.inline-audio-fields p {
  margin: 0 0 6px;
  overflow-wrap: anywhere;
  color: var(--agui-c-text-2);
}
.inline-audio-fields [role='alert'] {
  color: var(--agui-c-danger-text);
}
</style>
