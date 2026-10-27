<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ scenarios: readonly { id: string, expectedEnding: string, choices: string }[], disabled: boolean }>()
const emit = defineEmits<{ update: [scenarios: { id: string, expectedEnding: string, choices: string }[]] }>()
const { t } = useI18n()
function patch(index: number, key: 'expectedEnding' | 'choices', value: string) {
  emit('update', props.scenarios.map((item, position) => position === index ? { ...item, [key]: value } : { ...item }))
}
function add() {
  const id = `path-${crypto.randomUUID().slice(0, 8)}`
  emit('update', [...props.scenarios, { id, expectedEnding: '', choices: '' }])
}
</script>

<template>
  <fieldset class="playtest-scenarios" :disabled="disabled">
    <legend>{{ t('creativeTeam.playtest.scenarios') }}</legend>
    <div v-for="(scenario, index) in scenarios" :key="scenario.id" class="playtest-scenarios__item">
      <strong>{{ t('creativeTeam.playtest.path', { index: index + 1 }) }}</strong>
      <label>
        {{ t('creativeTeam.playtest.expected') }}
        <input :value="scenario.expectedEnding" type="text" maxlength="140" placeholder="stay#ending-stay" @input="patch(index, 'expectedEnding', ($event.target as HTMLInputElement).value)">
      </label>
      <label>
        {{ t('creativeTeam.playtest.choices') }}
        <input :value="scenario.choices" type="text" maxlength="128" placeholder="0, 1" @input="patch(index, 'choices', ($event.target as HTMLInputElement).value)">
      </label>
      <SButton v-if="scenarios.length > 1" size="lg" variant="ghost" :disabled="disabled" @click="emit('update', scenarios.filter(item => item.id !== scenario.id).map(item => ({ ...item })))">
        {{ t('creativeTeam.playtest.remove') }}
      </SButton>
    </div>
    <SButton v-if="scenarios.length < 12" size="lg" variant="outline" :disabled="disabled" @click="add">
      {{ t('creativeTeam.playtest.add') }}
    </SButton>
  </fieldset>
</template>

<style scoped>
.playtest-scenarios {
  min-width: 0;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
}
.playtest-scenarios__item {
  display: grid;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md) 0;
}
.playtest-scenarios label {
  display: grid;
  gap: var(--adv-space-xs);
}
.playtest-scenarios input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-page);
  color: var(--adv-text-primary);
  font: inherit;
}
.playtest-scenarios input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
