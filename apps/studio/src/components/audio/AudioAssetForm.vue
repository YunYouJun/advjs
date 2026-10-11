<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import type { StudioAudioKind } from '../../utils/audioWorkspace'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { studioAudioKinds } from '../../utils/audioWorkspace'
import SButton from '../ui/SButton.vue'
import SFormField from '../ui/SFormField.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'

export interface StudioAudioMetadata {
  title: string
  kind: StudioAudioKind
  labels: string[]
  license: string
  loop: boolean
}

const props = defineProps<{ asset?: AdvAssetEntry, busy: boolean, immutable?: boolean }>()
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
const file = ref<File>()
const options = computed(() => studioAudioKinds.map(value => ({ value, label: t(`audioWorkspace.kind.${value}`) })))
const purposeSelected = computed(() => studioAudioKinds.includes(kind.value as StudioAudioKind))
watch(() => props.asset, (asset) => {
  title.value = asset?.title ?? asset?.id ?? ''
  kind.value = studioAudioKinds.includes(asset?.kind as StudioAudioKind) ? asset!.kind : undefined
  labels.value = asset?.labels?.join(', ') ?? ''
  license.value = asset?.license ?? ''
  loop.value = asset?.loop ?? false
  file.value = undefined
}, { immediate: true })

function save() {
  if (!purposeSelected.value)
    return
  emit('save', { title: title.value.trim(), kind: kind.value as StudioAudioKind, labels: [...new Set(labels.value.split(',').map(label => label.trim()).filter(Boolean))], license: license.value.trim(), loop: loop.value }, file.value)
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
    <label class="audio-asset-form__check"><input v-model="loop" type="checkbox" :disabled="busy || immutable">{{ t('audioWorkspace.loop') }}</label>
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
