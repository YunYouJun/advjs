<script setup lang="ts">
import type { setVoiceListeningEnvironment } from '@advjs/audio'
import { useI18n } from 'vue-i18n'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'

const _props = defineProps<{ value: Parameters<typeof setVoiceListeningEnvironment>[1], humanConfirmed: boolean, canAttest: boolean }>()
const emit = defineEmits<{ update: [value: typeof _props.value], attest: [value: boolean] }>()
const { t } = useI18n()
const fields = ['reviewerId', 'device', 'systemVolume', 'language', 'notes'] as const
</script>

<template>
  <fieldset class="listening-environment">
    <legend>{{ t('voiceListening.environmentTitle') }}</legend>
    <label v-for="field in fields" :key="field" class="listening-environment__field">
      <span>{{ t(`voiceListening.environment.${field}`) }}</span>
      <SInput size="lg" :model-value="value[field]" :maxlength="field === 'reviewerId' || field === 'language' ? 80 : 160" :aria-label="t(`voiceListening.environment.${field}`)" @update:model-value="emit('update', { ...value, [field]: $event })" />
    </label>
    <label class="listening-environment__field">
      <span>{{ t('voiceListening.environment.outputMode') }}</span>
      <SSelect size="lg" :model-value="value.outputMode || undefined" :placeholder="t('voiceListening.chooseOutput')" :aria-label="t('voiceListening.environment.outputMode')" :options="['headphones', 'bluetooth', 'speakers', 'external', 'other'].map(option => ({ value: option, label: t(`voiceListening.output.${option}`) }))" @update:model-value="emit('update', { ...value, outputMode: $event })" />
    </label>
    <label class="listening-environment__attest">
      <input type="checkbox" :checked="humanConfirmed" :disabled="!canAttest" @change="emit('attest', ($event.target as HTMLInputElement).checked)">
      <span>{{ t('voiceListening.humanAttestation') }}</span>
    </label>
    <p v-if="!canAttest">
      {{ t('voiceListening.attestationHint') }}
    </p>
  </fieldset>
</template>

<style scoped>
.listening-environment {
  display: grid;
  gap: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  padding: var(--adv-space-md);
  min-width: 0;
}
.listening-environment__field {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
}
.listening-environment__attest {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  min-height: 48px;
}
.listening-environment__attest input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--adv-primary);
}
@media (min-width: 768px) {
  .listening-environment {
    grid-template-columns: 1fr 1fr;
  }
  .listening-environment__attest {
    grid-column: 1 / -1;
  }
}
</style>
