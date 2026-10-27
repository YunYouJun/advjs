<script setup lang="ts">
import { audioBuses, parseAudioMixerConfig } from '@advjs/audio'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'
import AGUITextarea from '@advjs/gui/client/components/textarea/AGUITextarea.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { computed, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import { useAudioStore } from '../../../stores/useAudioStore'
import { useProjectDrafts } from '../../../stores/useProjectDrafts'

const project = useProjectStore()
const audio = useAudioStore()
const drafts = useProjectDrafts()
const id = useId()
const path = computed(() => `${project.project?.compilation.project.root ?? 'adv'}/audio/mixer.json`)
const source = computed(() => project.project?.files[path.value] ?? null)
const defaultDocument = `${JSON.stringify({ schemaVersion: 1, buses: Object.fromEntries(audioBuses.map(bus => [bus, { gain: 1, muted: false, solo: false }])), ducking: { enabled: true, gain: 0.35, attackMs: 120, releaseMs: 300 }, sfx: { maxVoices: 8 } }, null, 2)}\n`
const expected = shallowRef<string | null>(null)
const draft = shallowRef('')
const saving = shallowRef(false)
const error = shallowRef('')
const status = shallowRef('')
const dirty = computed(() => draft.value !== (expected.value ?? defaultDocument))
const conflict = computed(() => source.value !== expected.value)
const writable = computed(() => audio.supportedRoot && Boolean(project.workspace?.writeFiles))
const validation = computed(() => {
  try {
    parseAudioMixerConfig(JSON.parse(draft.value))
    return ''
  }
  catch (failure) { return failure instanceof Error ? failure.message : String(failure) }
})
function reload() {
  expected.value = source.value
  draft.value = source.value ?? defaultDocument
  error.value = ''
  status.value = ''
}
watch(() => project.workspace, reload, { immediate: true })
watch(source, () => {
  if (!dirty.value)
    reload()
})
watch(dirty, value => drafts.register(id, { dirty: value, save }), { immediate: true })
onBeforeUnmount(() => drafts.remove(id))
async function save() {
  if (!writable.value || validation.value || saving.value)
    return false
  const workspace = project.workspace
  saving.value = true
  error.value = ''
  try {
    await audio.saveMixer(path.value, draft.value, expected.value)
    if (project.workspace !== workspace)
      return false
    reload()
    status.value = '混音配置已保存到项目。'
    return true
  }
  catch (failure) {
    if (project.workspace === workspace)
      error.value = failure instanceof Error ? failure.message : String(failure)
    return false
  }
  finally { saving.value = false }
}
</script>

<template>
  <section class="ae-mixer-panel" aria-label="项目混音配置">
    <AGUIToolbar :items="[]" label="混音配置">
      <template #before-toolbar>
        <span>六总线 · {{ audioBuses.join(' / ') }}</span>
      </template>
    </AGUIToolbar>
    <AGUIForm class="ae-mixer-editor" padded>
      <p class="ae-resource-caption">
        项目默认音量、静音、独奏、对白压低音乐与音效并发限制。
      </p>
      <AGUIFormItem :for="`${id}-json`" label="Mixer JSON" label-align="top">
        <AGUITextarea :id="`${id}-json`" v-model="draft" :disabled="saving || !writable" :rows="18" spellcheck="false" class="ae-mixer-source" />
      </AGUIFormItem>
      <p v-if="validation" class="ae-resource-error" role="alert">
        {{ validation }}
      </p>
      <p v-if="conflict" class="ae-resource-caption" role="status">
        项目文件已变化。草稿已保留，请载入最新版本后重新编辑。
      </p>
      <p v-if="error" class="ae-resource-error" role="alert">
        {{ error }}
      </p>
      <p v-if="status" class="ae-resource-caption" role="status">
        {{ status }}
      </p>
      <div class="ae-resource-actions">
        <AGUIButton :disabled="saving" @click="reload">
          载入项目版本
        </AGUIButton>
        <AGUIButton theme="primary" :disabled="!writable || Boolean(validation) || conflict || (!dirty && source !== null)" :loading="saving" data-testid="mixer-save" @click="save">
          保存混音配置
        </AGUIButton>
      </div>
      <p class="ae-resource-caption">
        {{ path }}
      </p>
    </AGUIForm>
  </section>
</template>

<style scoped>
.ae-mixer-source {
  width: 100%;
  font-family: monospace;
  font-size: 12px;
}
</style>
