<script setup lang="ts">
import type { CreativePartnerId } from '@advjs/agent'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ partner: CreativePartnerId, disabled: boolean, busy: boolean }>()
const emit = defineEmits<{ submit: [value: { goal: string, maxMicroPoints: number }] }>()
const { t } = useI18n()
const goal = shallowRef('')
const budget = shallowRef('')
const microPoints = computed(() => {
  if (!/^\d+(?:\.\d{1,3})?$/.test(budget.value))
    return undefined
  const value = Math.round(Number(budget.value) * 1000)
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
})
function submit() {
  if (!props.disabled && !props.busy && microPoints.value && goal.value.trim())
    emit('submit', { goal: goal.value.trim(), maxMicroPoints: microPoints.value })
}
</script>

<template>
  <form class="team-request" @submit.prevent="submit">
    <h2 class="team-request__title">
      {{ t(`creativeTeam.roles.${partner}`) }}
    </h2>
    <label for="team-goal">{{ t('creativeTeam.goal') }}</label>
    <textarea id="team-goal" v-model="goal" class="team-request__input" rows="4" maxlength="4000" required :placeholder="t('creativeTeam.goalPlaceholder')" :disabled="busy" aria-describedby="team-saved-hint" />
    <p id="team-saved-hint" class="team-request__hint">
      {{ t('creativeTeam.savedOnly') }}
    </p>
    <label for="team-budget">{{ t('creativeTeam.budget') }}</label>
    <input id="team-budget" v-model="budget" class="team-request__input" inputmode="decimal" required :disabled="busy" aria-describedby="team-budget-hint">
    <p id="team-budget-hint" class="team-request__hint">
      {{ t('creativeTeam.budgetHint') }}
    </p>
    <SButton type="submit" size="lg" :disabled="disabled || !goal.trim() || !microPoints" :loading="busy">
      {{ t('creativeTeam.start') }}
    </SButton>
  </form>
</template>

<style scoped>
.team-request {
  display: grid;
  gap: var(--adv-space-sm);
}
.team-request__title {
  font-size: var(--adv-font-title);
  margin: 0 0 var(--adv-space-sm);
}
.team-request__input {
  width: 100%;
  min-height: 44px;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-page);
  font: inherit;
  resize: vertical;
}
.team-request__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.team-request__hint {
  margin: 0 0 var(--adv-space-sm);
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}
</style>
