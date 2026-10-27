<script setup lang="ts">
import type { AudioPronunciationDictionary } from '@advjs/types'
import { AUDIO_PRONUNCIATION_PATH, createAudioPronunciationDictionary, parseAudioPronunciationDictionary } from '@advjs/audio'
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'
import AGUITextarea from '@advjs/gui/client/components/textarea/AGUITextarea.vue'
import AGUIToolbar from '@advjs/gui/client/components/toolbar/AGUIToolbar.vue'
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useAudioStore } from '../../../stores/useAudioStore'
import { useProjectDrafts } from '../../../stores/useProjectDrafts'
import { useProjectStore } from '../../../stores/useProjectStore'

const audio = useAudioStore()
const project = useProjectStore()
const drafts = useProjectDrafts()
const id = useId()
const dictionary = ref(createAudioPronunciationDictionary())
const expectedRevision = ref('')
const expectedSource = ref<string | null>(null)
const replacements = ref('{}')
const locales = ref('{}')
const saving = ref(false)
const loading = ref(false)
const error = ref('')
const status = ref('')
let sequence = 0
const source = computed(() => project.project?.files[AUDIO_PRONUNCIATION_PATH] ?? null)
const writable = computed(() => audio.supportedRoot && Boolean(project.workspace?.writeFiles))
const formatted = (value: unknown) => JSON.stringify(value, null, 2)
const dirty = computed(() => replacements.value !== formatted(dictionary.value.replacements) || locales.value !== formatted(dictionary.value.locales))
const conflict = computed(() => source.value !== expectedSource.value)
const parsed = computed<{ dictionary?: AudioPronunciationDictionary, error?: string }>(() => {
  try {
    return { dictionary: parseAudioPronunciationDictionary({ schemaVersion: 1, revision: dictionary.value.revision, replacements: JSON.parse(replacements.value), locales: JSON.parse(locales.value) }) }
  }
  catch (failure) { return { error: failure instanceof Error ? failure.message : String(failure) } }
})
function apply(value: { dictionary: AudioPronunciationDictionary, revision: string }) {
  dictionary.value = value.dictionary
  expectedRevision.value = value.revision
  expectedSource.value = source.value
  replacements.value = formatted(value.dictionary.replacements)
  locales.value = formatted(value.dictionary.locales)
}
async function reload() {
  const current = ++sequence
  loading.value = true
  error.value = ''
  status.value = ''
  try {
    const result = await audio.authoring().readPronunciation()
    if (current === sequence)
      apply(result)
  }
  catch (failure) {
    if (current === sequence)
      error.value = failure instanceof Error ? failure.message : String(failure)
  }
  finally {
    if (current === sequence)
      loading.value = false
  }
}
async function save() {
  if (!writable.value || !parsed.value.dictionary || saving.value || !expectedRevision.value)
    return false
  const current = sequence
  const workspace = project.workspace
  saving.value = true
  error.value = ''
  try {
    const result = await audio.authoring().savePronunciation({ expectedRevision: expectedRevision.value, dictionary: parsed.value.dictionary })
    if (current !== sequence || project.workspace !== workspace)
      return false
    apply(result)
    status.value = '发音词典已保存；已有音频保持不变，依赖词典的旧录音会显示过期。'
    return true
  }
  catch (failure) {
    if (current === sequence)
      error.value = failure instanceof Error ? failure.message : String(failure)
    return false
  }
  finally { saving.value = false }
}
watch(() => project.workspace, () => {
  void reload()
}, { immediate: true })
watch(source, () => {
  if (!dirty.value && !saving.value)
    void reload()
})
watch(dirty, value => drafts.register(id, { dirty: value, save }), { immediate: true })
onBeforeUnmount(() => {
  sequence++
  drafts.remove(id)
})
</script>

<template>
  <section class="ae-pronunciation-panel" aria-label="项目发音词典">
    <AGUIToolbar :items="[]" label="发音词典">
      <template #before-toolbar>
        <span>版本 {{ dictionary.revision }}</span>
      </template>
    </AGUIToolbar>
    <AGUIForm class="ae-pronunciation-editor" padded>
      <p class="ae-resource-caption">
        词条按最长匹配单次替换。语言词条优先于全局词条；逐句口播覆盖优先于词典。
      </p>
      <AGUIFormItem :for="`${id}-global`" label="全局词条：原文 → 读法" label-align="top">
        <AGUITextarea :id="`${id}-global`" v-model="replacements" :disabled="saving || loading || !writable" :rows="6" spellcheck="false" placeholder="{&quot;ADV.JS&quot;: &quot;冒险引擎&quot;}" data-testid="pronunciation-global" />
      </AGUIFormItem>
      <AGUIFormItem :for="`${id}-locales`" label="精确语言词条" label-align="top">
        <AGUITextarea :id="`${id}-locales`" v-model="locales" :disabled="saving || loading || !writable" :rows="8" spellcheck="false" placeholder="{&quot;zh-CN&quot;: {&quot;replacements&quot;: {&quot;ADV.JS&quot;: &quot;中文引擎&quot;}}}" data-testid="pronunciation-locales" />
      </AGUIFormItem>
      <p class="ae-resource-caption">
        使用 zh-CN / ja-JP 等完整语言标记；最多 512 个词条，替换值为普通文本。
      </p>
      <p v-if="parsed.error || error" class="ae-resource-error" role="alert">
        {{ parsed.error || error }}
      </p>
      <p v-if="conflict" class="ae-resource-caption" role="status">
        项目词典已变化；草稿已保留，请载入最新版本后重新编辑。
      </p>
      <p v-if="status" class="ae-resource-caption" role="status">
        {{ status }}
      </p>
      <div class="ae-resource-actions">
        <AGUIButton :disabled="saving || loading" @click="reload">
          载入项目版本
        </AGUIButton>
        <AGUIButton theme="primary" :disabled="!writable || loading || Boolean(parsed.error) || conflict || (!dirty && source !== null)" :loading="saving" data-testid="pronunciation-save" @click="save">
          保存词典
        </AGUIButton>
      </div>
      <p class="ae-resource-caption">
        {{ AUDIO_PRONUNCIATION_PATH }}
      </p>
    </AGUIForm>
  </section>
</template>

<style scoped>
.ae-pronunciation-editor :deep(textarea) {
  width: 100%;
  font-family: monospace;
  font-size: 12px;
}
</style>
