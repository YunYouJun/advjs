<script setup lang="ts">
import { onScopeDispose, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectContent } from '../../composables/useProjectContent'
import { useAuthStore } from '../../stores/useAuthStore'
import { useStudioStore } from '../../stores/useStudioStore'
import { commitStudioMarkdownMusicBinding, prepareStudioMarkdownMusicBinding } from '../../utils/musicWorkflow'
import SButton from '../ui/SButton.vue'
import SSelect from '../ui/SSelect.vue'

const props = defineProps<{ assetId: string, active: boolean }>()
const { t } = useI18n()
const project = useProjectContent()
const studio = useStudioStore()
const auth = useAuthStore()
const path = shallowRef('')
const plan = shallowRef<Awaited<ReturnType<typeof prepareStudioMarkdownMusicBinding>>>()
const busy = shallowRef(false)
const status = shallowRef('')
let epoch = 0
let preparedFs: ReturnType<typeof project.getFs> | undefined

function invalidate() {
  epoch++
  plan.value = undefined
  preparedFs = undefined
  busy.value = false
  status.value = ''
}
watch([() => props.assetId, () => props.active, path, () => studio.currentProjectId, () => auth.userId], invalidate, { flush: 'sync' })
onScopeDispose(invalidate)
async function run(save: boolean) {
  const fs = project.getFs()
  if (!fs || !props.active || !path.value || busy.value)
    return
  const version = epoch
  const id = studio.currentProjectId
  const actor = auth.userId
  const assertCurrent = () => {
    if (epoch !== version || !props.active || studio.currentProjectId !== id || auth.userId !== actor || project.getFs() !== fs)
      throw new Error('AUDIO_MUSIC_SCOPE_CHANGED')
  }
  busy.value = true
  status.value = ''
  try {
    if (save && plan.value) {
      if (fs !== preparedFs)
        throw new Error('AUDIO_MUSIC_SCOPE_CHANGED')
      await commitStudioMarkdownMusicBinding(fs, plan.value, assertCurrent)
      assertCurrent()
      plan.value = undefined
      preparedFs = undefined
      await project.reload()
      status.value = t('musicWorkflow.mdSaved')
    }
    else {
      const next = await prepareStudioMarkdownMusicBinding(fs, path.value, props.assetId)
      assertCurrent()
      preparedFs = fs
      plan.value = next
    }
  }
  catch (cause) {
    if (epoch === version)
      status.value = cause instanceof Error ? cause.message.split(':')[0]! : 'MUSIC_BINDING_FAILED'
  }
  finally {
    if (epoch === version)
      busy.value = false
  }
}
</script>

<template>
  <section class="markdown-music-binding" data-testid="markdown-music-binding">
    <h3>{{ t('musicWorkflow.bindTitle') }}</h3>
    <p>{{ t('musicWorkflow.mdHint') }}</p>
    <SSelect v-model="path" size="lg" :options="project.chapters.value.filter(chapter => chapter.file.endsWith('.adv.md')).map(chapter => ({ value: chapter.file, label: chapter.name }))" :placeholder="t('flowEditor.chooseChapter')" :aria-label="t('flowEditor.chapter')" :disabled="busy" />
    <SButton size="lg" variant="outline" :disabled="!path || busy || !active" @click="run(false)">
      {{ t('musicWorkflow.mdReview') }}
    </SButton>
    <template v-if="plan">
      <details open>
        <summary>{{ t('musicWorkflow.mdPreview') }}</summary><pre>{{ plan.content }}</pre>
      </details>
      <SButton size="lg" :disabled="busy || !active" @click="run(true)">
        {{ t('musicWorkflow.mdSave') }}
      </SButton>
    </template>
    <p v-if="status" role="status">
      {{ status }}
    </p>
  </section>
</template>

<style scoped>
.markdown-music-binding {
  display: grid;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
}
.markdown-music-binding h3,
.markdown-music-binding p {
  margin: 0;
}
.markdown-music-binding p {
  color: var(--adv-text-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.markdown-music-binding summary {
  min-height: 44px;
  display: flex;
  align-items: center;
}
.markdown-music-binding pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 320px;
  overflow: auto;
  background: var(--adv-surface-elevated);
  padding: var(--adv-space-md);
}
.markdown-music-binding :deep(.s-button) {
  white-space: normal;
}
</style>
