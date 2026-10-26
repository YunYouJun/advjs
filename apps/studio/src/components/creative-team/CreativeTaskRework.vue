<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ taskId: string, busy: boolean, attempt: number, maximum: number }>()
const emit = defineEmits<{ request: [value: { type: 'request-rework', taskId: string, reason: string }] }>()
const { t } = useI18n()
const reason = shallowRef('')
function submit() {
  if (!props.busy && reason.value.trim())
    emit('request', { type: 'request-rework', taskId: props.taskId, reason: reason.value.trim() })
}
</script>

<template>
  <form class="task-rework" data-testid="creative-task-rework" @submit.prevent="submit">
    <label :for="`creative-rework-${taskId}`">{{ t('creativeTeam.reworkReason') }}</label>
    <textarea :id="`creative-rework-${taskId}`" v-model="reason" class="task-rework__input" rows="2" maxlength="4000" required :disabled="busy" />
    <p class="task-rework__hint">
      {{ t('creativeTeam.reworkHint') }}
    </p>
    <p class="task-rework__hint">
      {{ t('creativeTeam.reworkAttempts', { attempt, maximum }) }}
    </p>
    <SButton size="lg" variant="outline" type="submit" :disabled="!reason.trim() || attempt >= maximum" :loading="busy">
      {{ t('creativeTeam.rework') }}
    </SButton>
  </form>
</template>

<style scoped>
.task-rework {
  display: grid;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-md);
}
.task-rework__hint {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
}
.task-rework__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-page);
  color: var(--adv-text-primary);
  font: inherit;
}
.task-rework__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
