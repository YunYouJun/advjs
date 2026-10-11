<script setup lang="ts">
import type { MarkdownAudioTarget, ProjectAudioOperation } from '@advjs/core'
import type { ProjectFlowSource } from '../../../utils/project-flow'
import { patchMarkdownAudioOperations, readMarkdownAudioTarget } from '@advjs/core'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIToolbar from '@advjs/gui/components/toolbar/AGUIToolbar.vue'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import AEAudioOperationEditor from '../../panel/audio/AEAudioOperationEditor.vue'

const props = defineProps<{ source?: ProjectFlowSource, zh: boolean, busy: boolean }>()
const emit = defineEmits<{ close: [] }>()
const project = useProjectStore()
const file = useFileStore()
const target = shallowRef<MarkdownAudioTarget>()
const expected = shallowRef('')
const operations = ref<ProjectAudioOperation[]>([])
const error = shallowRef('')
const status = shallowRef('')
const loading = shallowRef(false)
const saving = shallowRef(false)
let generation = 0
const conflict = computed(() => props.source && expected.value !== project.project?.files[props.source.path])
const unsaved = computed(() => props.source?.path === file.openedFilePath && file.isDirty)
const writable = computed(() => Boolean(project.workspace?.writeFiles && target.value && !unsaved.value && !conflict.value && !loading.value && !saving.value && !props.busy))
async function load() {
  const source = props.source
  const sequence = ++generation
  target.value = undefined
  error.value = ''
  status.value = ''
  if (!source)
    return
  loading.value = true
  try {
    const text = project.project?.files[source.path]
    if (text === undefined || !source.path.endsWith('.adv.md'))
      throw new Error('ADV_AUDIO_SOURCE_REQUIRED: Open a native Markdown story node')
    const result = await readMarkdownAudioTarget(text, source.line)
    if (sequence !== generation)
      return
    expected.value = text
    target.value = result
    operations.value = result.operations
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
watch(() => [props.source?.path, props.source?.line, project.workspace], load, { immediate: true })
onBeforeUnmount(() => {
  generation++
})
async function save() {
  if (!writable.value || !props.source || !target.value)
    return
  const sequence = generation
  const path = props.source.path
  saving.value = true
  error.value = ''
  status.value = ''
  try {
    const content = await patchMarkdownAudioOperations(expected.value, target.value, operations.value, project.project?.compilation.project.assets)
    await project.writeProjectFiles([{ path, expected: expected.value, content }])
    if (sequence === generation) {
      if (!operations.value.length && target.value.existing) {
        emit('close')
        return
      }
      await load()
      status.value = props.zh ? '场景音频已保存。' : 'Scene audio saved.'
    }
  }
  catch (cause) {
    if (sequence === generation)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally { saving.value = false }
}
</script>

<template>
  <section v-if="source" class="flow-audio-inspector" :aria-label="zh ? '流程音频属性' : 'Story audio properties'" :aria-busy="loading || saving">
    <AGUIToolbar :items="[]" :label="zh ? '流程音频属性' : 'Story audio properties'">
      <template #before-toolbar>
        <span class="source-path" :title="source.path">{{ source.path }}:{{ source.line }}</span>
      </template>
      <template #after-toolbar>
        <AGUIButton :disabled="!writable" data-testid="flow-audio-save" @click="save">
          {{ zh ? '保存' : 'Save' }}
        </AGUIButton>
        <AGUIButton :disabled="saving" @click="load">
          {{ zh ? '重新读取' : 'Reload' }}
        </AGUIButton>
        <AGUIButton :disabled="saving" @click="emit('close')">
          {{ zh ? '关闭' : 'Close' }}
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <div class="audio-properties">
      <p v-if="error" class="audio-error" role="alert">
        {{ error }}
      </p>
      <p v-if="conflict" class="audio-error" role="alert">
        {{ zh ? '源文件已变化，草稿已保留；重新读取后再保存。' : 'Source changed. Draft preserved; reload before saving.' }}
      </p>
      <p v-if="unsaved" role="status">
        {{ zh ? '请先保存或放弃该文件的源码草稿。' : 'Save or discard the source draft first.' }}
      </p>
      <p v-if="target" role="status">
        {{ target.existing ? (zh ? '更新当前音频代码块；其他演出操作和正文保持原样。' : 'Update this audio block; other operations and prose are preserved.') : (zh ? '音频操作将插入当前剧情节点之前。' : 'Audio operations will be inserted before this story node.') }}
      </p>
      <AEAudioOperationEditor v-if="target" v-model="operations" :catalog="project.project?.compilation.project.assets" :zh="zh" :disabled="loading || saving" />
      <p v-if="status" role="status">
        {{ status }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.flow-audio-inspector {
  flex: 0 1 45%;
  min-height: 100px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--agui-c-divider);
  background: var(--agui-c-bg-panel);
  font-size: 12px;
}
.source-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.audio-properties {
  min-height: 0;
  padding: 8px;
  overflow: auto;
}
.audio-properties p {
  margin: 0 0 6px;
  overflow-wrap: anywhere;
  color: var(--agui-c-text-2);
}
.audio-properties .audio-error {
  color: var(--agui-c-danger-text);
}
</style>
