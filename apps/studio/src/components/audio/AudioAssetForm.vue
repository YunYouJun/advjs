<script setup lang="ts">
import type { AdvAssetEntry, AdvMusicMetadata } from '@advjs/types'
import type { StudioAudioKind } from '../../utils/audioWorkspace'
import { musicPlaybackDefaults } from '@advjs/audio'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { studioAudioKinds } from '../../utils/audioWorkspace'
import SButton from '../ui/SButton.vue'
import SFormField from '../ui/SFormField.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'
import AudioMusicFields from './AudioMusicFields.vue'

export interface StudioAudioMetadata {
  title: string
  kind: StudioAudioKind
  labels: string[]
  license: string
  loop: boolean
  music?: AdvMusicMetadata
}

const props = defineProps<{ asset?: AdvAssetEntry, busy: boolean, immutable?: boolean, initialMusic?: AdvMusicMetadata }>()
const emit = defineEmits<{
  save: [data: StudioAudioMetadata, file?: File]
  cancel: []
}>()
const { t } = useI18n()
const title = ref('')
const kind = ref<string>()
const labels = ref('')
const license = ref('')
const loop = ref(false)
const loopEdited = ref(false)
const file = ref<File>()
const musicFields = useTemplateRef<{ read: () => AdvMusicMetadata }>('musicFields')
const trackMusic = ref(false)
const musicError = ref('')
const options = computed(() => studioAudioKinds.map(value => ({ value, label: t(`audioWorkspace.kind.${value}`) })))
const purposeSelected = computed(() => studioAudioKinds.includes(kind.value as StudioAudioKind))
watch([() => props.asset, () => props.initialMusic], ([asset, initialMusic]) => {
  title.value = asset?.title ?? asset?.id ?? ''
  kind.value = studioAudioKinds.includes(asset?.kind as StudioAudioKind) ? asset!.kind : initialMusic ? 'bgm' : undefined
  labels.value = asset?.labels?.join(', ') ?? ''
  license.value = asset?.license ?? asset?.music?.rights?.license ?? initialMusic?.rights?.license ?? ''
  trackMusic.value = Boolean(!asset || asset.music || initialMusic)
  musicError.value = ''
  loopEdited.value = false
  loop.value = asset?.loop ?? (kind.value === 'bgm' ? musicPlaybackDefaults(asset?.music?.usage ?? initialMusic?.usage ?? 'background').loop : false)
  file.value = undefined
}, { immediate: true })

watch(kind, (value) => {
  if (!props.asset && value === 'bgm' && !loopEdited.value)
    loop.value = musicPlaybackDefaults(props.initialMusic?.usage ?? 'background').loop
})
function musicUsage(value: AdvMusicMetadata['usage']) {
  if (!props.asset && !loopEdited.value)
    loop.value = musicPlaybackDefaults(value).loop
}
function save() {
  if (!purposeSelected.value)
    return
  try {
    const music = kind.value === 'bgm' && trackMusic.value ? musicFields.value?.read() : undefined
    emit('save', { title: title.value.trim(), kind: kind.value as StudioAudioKind, labels: [...new Set(labels.value.split(',').map(label => label.trim()).filter(Boolean))], license: license.value.trim(), loop: loop.value, ...(music ? { music } : {}) }, file.value)
    musicError.value = ''
  }
  catch { musicError.value = t('musicWorkflow.invalid') }
}
</script>

<template>
  <form class="audio-asset-form" @submit.prevent="save">
    <SFormField v-if="!asset" :label="t('audioWorkspace.localFile')">
      <input class="audio-asset-form__file" type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a,.aac,.flac,.opus,.webm" :disabled="busy" required :aria-label="t('audioWorkspace.localFile')" @change="file = ($event.target as HTMLInputElement).files?.[0]">
    </SFormField>
    <SFormField :label="t('audio.name')">
      <SInput v-model="title" size="lg" :disabled="busy" :aria-label="t('audio.name')" />
    </SFormField>
    <SFormField :label="t('audioWorkspace.purpose')" :hint="immutable ? t('audioWorkspace.immutableKind') : undefined">
      <SSelect v-model="kind" size="lg" :placeholder="t('audioWorkspace.purpose')" :options="options" :disabled="busy || immutable" :aria-label="t('audioWorkspace.purpose')" />
    </SFormField>
    <SFormField :label="t('audioWorkspace.labels')">
      <SInput v-model="labels" size="lg" :disabled="busy" :aria-label="t('audioWorkspace.labels')" />
    </SFormField>
    <SFormField :label="t('audioWorkspace.license')">
      <SInput v-model="license" size="lg" :disabled="busy" :aria-label="t('audioWorkspace.license')" />
    </SFormField>
    <template v-if="kind === 'bgm'">
      <label v-if="asset && !asset.music" class="audio-asset-form__check"><input v-model="trackMusic" type="checkbox" :disabled="busy">{{ t('musicWorkflow.trackLegacy') }}</label>
      <AudioMusicFields v-if="trackMusic" ref="musicFields" :music="asset?.music ?? initialMusic" :license="license" :busy="busy" @usage="musicUsage" />
      <p v-if="musicError" role="alert">
        {{ musicError }}
      </p>
    </template>
    <label class="audio-asset-form__check"><input v-model="loop" type="checkbox" :disabled="busy || immutable" @change="loopEdited = true">{{ t('audioWorkspace.loop') }}</label>
    <div class="audio-asset-form__actions">
      <SButton type="submit" size="lg" :loading="busy" :disabled="!purposeSelected || (!asset && !file)">
        {{ t(asset ? 'audioWorkspace.saveMetadata' : 'audioWorkspace.importAsset') }}
      </SButton>
      <SButton size="lg" variant="ghost" :disabled="busy" @click="emit('cancel')">
        {{ t('common.cancel') }}
      </SButton>
    </div>
  </form>
</template>

<style scoped>
.audio-asset-form {
  display: grid;
  gap: 16px;
}
.audio-asset-form__file {
  width: 100%;
  min-height: 44px;
  padding: 8px 0;
  color: var(--adv-text-primary);
}
.audio-asset-form__check {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.audio-asset-form__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
