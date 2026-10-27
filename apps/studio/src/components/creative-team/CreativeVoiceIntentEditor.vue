<script setup lang="ts">
import type { CreativeVoiceIntent } from '@advjs/agent'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ id: string, speakerId: string, performance: string, busy: boolean }>()
const model = defineModel<CreativeVoiceIntent>()
const { t } = useI18n()
function field(key: keyof CreativeVoiceIntent, value: string) {
  const next = { ...model.value }
  if (!value.trim())
    delete next[key]
  else if (key === 'temperament')
    next.temperament = value.split('\n').map(item => item.trim()).filter(Boolean)
  else
    Object.assign(next, { [key]: value })
  model.value = next
}
function enable(checked: boolean) {
  model.value = checked ? { speakingStyle: props.performance } : undefined
}
</script>

<template>
  <fieldset class="voice-intent">
    <legend>{{ speakerId }}</legend>
    <label class="voice-intent__approval"><input type="checkbox" :checked="Boolean(model)" :disabled="busy" @change="enable(($event.target as HTMLInputElement).checked)"><span>{{ t('creativeTeam.voicePlan.includeIntent') }}</span></label>
    <template v-if="model">
      <label v-for="key in ['ageImpression', 'genderExpression', 'speakingStyle'] as const" :key="key" :for="`${id}-${key}`">{{ t(`creativeTeam.voicePlan.${key}`) }}<textarea :id="`${id}-${key}`" class="voice-intent__input" :rows="key === 'speakingStyle' ? 3 : 1" :value="model[key] ?? ''" maxlength="4000" :disabled="busy" @input="field(key, ($event.target as HTMLTextAreaElement).value)" /></label>
      <label :for="`${id}-temperament`">{{ t('creativeTeam.voicePlan.temperament') }}<textarea :id="`${id}-temperament`" class="voice-intent__input" :value="model.temperament?.join('\n') ?? ''" rows="2" :disabled="busy" @input="field('temperament', ($event.target as HTMLTextAreaElement).value)" /></label>
      <label v-for="key in ['pitch', 'pace'] as const" :key="key" :for="`${id}-${key}`">{{ t(`creativeTeam.voicePlan.${key}`) }}<select :id="`${id}-${key}`" class="voice-intent__input" :value="model[key] ?? ''" :disabled="busy" @change="field(key, ($event.target as HTMLSelectElement).value)"><option value="">{{ t('creativeTeam.voicePlan.keep') }}</option><option v-for="value in key === 'pitch' ? ['low', 'medium', 'high'] : ['slow', 'medium', 'fast']" :key="value" :value="value">{{ t(`creativeTeam.voicePlan.${value}`) }}</option></select></label>
    </template>
  </fieldset>
</template>

<style scoped>
.voice-intent {
  display: grid;
  min-width: 0;
  gap: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  padding: var(--adv-space-md);
}
.voice-intent label {
  display: grid;
  gap: var(--adv-space-sm);
}
.voice-intent .voice-intent__approval {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  min-height: 44px;
}
.voice-intent__approval input {
  width: 20px;
  height: 20px;
  flex: none;
  accent-color: var(--adv-primary);
}
.voice-intent__input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: var(--adv-space-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  font: inherit;
  resize: vertical;
}
.voice-intent :is(input, select, textarea):focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
