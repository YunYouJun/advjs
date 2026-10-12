<script setup lang="ts">
import type { AdvMusicMetadata } from '@advjs/types'
import { exportMusicBrief } from '@advjs/audio'
import { shallowRef, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadAsFile } from '../../utils/fs'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import AudioMusicFields from './AudioMusicFields.vue'

const props = defineProps<{ active: boolean, busy: boolean }>()
const emit = defineEmits<{ import: [music: AdvMusicMetadata] }>()
const { t } = useI18n()
const fields = useTemplateRef<{ read: () => AdvMusicMetadata }>('fields')
const license = shallowRef('')
const status = shallowRef('')
function read() {
  if (!props.active || props.busy || !fields.value)
    return
  try {
    return fields.value.read()
  }
  catch {
    status.value = t('musicWorkflow.invalid')
  }
}
async function copy() {
  const music = read()
  if (!music)
    return
  try {
    await navigator.clipboard.writeText(exportMusicBrief(music))
    if (props.active)
      status.value = t('musicWorkflow.copied')
  }
  catch {
    if (props.active)
      status.value = t('musicWorkflow.copyFailed')
  }
}
function useBrief() {
  const music = read()
  if (music)
    emit('import', music)
}
function download() {
  const music = read()
  if (music)
    downloadAsFile(`${JSON.stringify(music, null, 2)}\n`, 'music-brief.json', 'application/json')
}
</script>

<template>
  <details class="music-brief" data-testid="music-brief">
    <summary>{{ t('musicWorkflow.handoff') }}</summary>
    <div class="music-brief__body">
      <p>{{ t('musicWorkflow.handoffHint') }}</p>
      <AudioMusicFields ref="fields" :busy="busy || !active" :license="license" />
      <label>{{ t('audioWorkspace.license') }}<SInput v-model="license" size="lg" :aria-label="t('audioWorkspace.license')" :disabled="busy || !active" /></label>
      <div class="music-brief__actions">
        <SButton size="lg" variant="outline" :disabled="busy || !active" @click="copy">
          {{ t('musicWorkflow.copy') }}
        </SButton>
        <SButton size="lg" variant="outline" :disabled="busy || !active" @click="download">
          {{ t('musicWorkflow.download') }}
        </SButton>
        <SButton size="lg" :disabled="busy || !active" @click="useBrief">
          {{ t('musicWorkflow.useBrief') }}
        </SButton>
        <a href="https://suno.com/create" target="_blank" rel="noopener noreferrer">{{ t('musicWorkflow.openSuno') }}</a>
      </div>
      <p v-if="status" role="status">
        {{ status }}
      </p>
    </div>
  </details>
</template>

<style scoped>
.music-brief {
  min-width: 0;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  padding: var(--adv-space-md);
}
.music-brief summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
  font-weight: 600;
}
.music-brief__body {
  display: grid;
  gap: var(--adv-space-md);
  margin-top: var(--adv-space-md);
}
.music-brief p {
  margin: 0;
  color: var(--adv-text-secondary);
  line-height: 1.6;
}
.music-brief label {
  display: grid;
  gap: var(--adv-space-xs);
}
.music-brief__actions {
  display: flex;
  gap: var(--adv-space-sm);
  flex-wrap: wrap;
}
.music-brief__actions a {
  display: flex;
  align-items: center;
  min-height: 48px;
  color: var(--adv-primary);
}
.music-brief__actions :deep(.s-button) {
  white-space: normal;
}
</style>
