<script setup lang="ts">
import type { CreativeTeamRun } from '@advjs/agent'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ run: CreativeTeamRun, disabled: boolean }>()
const emit = defineEmits<{ stage: [value: { artifactId: string, assetId: string, file: File, attribution: string, license: string }] }>()
const { t } = useI18n()
const selection = shallowRef('')
const file = shallowRef<File>()
const attribution = shallowRef('')
const license = shallowRef('')
const requests = computed(() => props.run.artifacts.flatMap(artifact => ['selected', 'adopted'].includes(artifact.status) && artifact.output?.kind === 'art-direction' ? artifact.output.requests.map(request => ({ artifactId: artifact.id, request, key: JSON.stringify([artifact.id, request.assetId]) })) : []))
const selected = computed(() => requests.value.find(item => item.key === selection.value))
watch(() => props.run.id, () => {
  selection.value = ''
  file.value = undefined
  attribution.value = ''
  license.value = ''
})
function submit() {
  if (props.disabled || !selected.value || !file.value || !attribution.value.trim())
    return
  emit('stage', { artifactId: selected.value.artifactId, assetId: selected.value.request.assetId, file: file.value, attribution: attribution.value, license: license.value })
}
</script>

<template>
  <form v-if="requests.length" class="art-import-form" @submit.prevent="submit">
    <label class="art-import-form__field">
      {{ t('creativeTeam.artImport.request') }}
      <select v-model="selection" class="art-import-form__input" :disabled="disabled" required>
        <option value="" disabled>{{ t('creativeTeam.artImport.request') }}</option>
        <option v-for="item in requests" :key="item.key" :value="item.key">{{ item.request.assetId }} · {{ item.request.width }} × {{ item.request.height }}</option>
      </select>
    </label>
    <p v-if="selected" class="art-import-form__description">
      {{ selected.request.prompt }} · {{ selected.request.constraints.join('；') }}
    </p>
    <label class="art-import-form__field">
      {{ t('creativeTeam.artImport.file') }}
      <input class="art-import-form__input" type="file" accept="image/png,image/jpeg,image/webp" :disabled="disabled" required @change="file = ($event.target as HTMLInputElement).files?.[0]">
    </label>
    <label class="art-import-form__field">
      {{ t('creativeTeam.artImport.attribution') }}
      <textarea v-model="attribution" class="art-import-form__input" rows="2" maxlength="1000" :disabled="disabled" required />
    </label>
    <label class="art-import-form__field">
      {{ t('creativeTeam.artImport.license') }}
      <input v-model="license" class="art-import-form__input" maxlength="200" :disabled="disabled">
    </label>
    <SButton size="lg" variant="outline" type="submit" :disabled="disabled || !selected || !file || !attribution.trim()">
      {{ t('creativeTeam.artImport.stage') }}
    </SButton>
  </form>
  <p v-else>
    {{ t('creativeTeam.artImport.noRequests') }}
  </p>
</template>

<style scoped>
.art-import-form {
  display: grid;
  gap: var(--adv-space-md);
  margin-block: var(--adv-space-md);
}
.art-import-form__field {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
}
.art-import-form__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-page);
  font: inherit;
}
.art-import-form__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.art-import-form__description {
  overflow-wrap: anywhere;
  color: var(--adv-text-secondary);
}
</style>
