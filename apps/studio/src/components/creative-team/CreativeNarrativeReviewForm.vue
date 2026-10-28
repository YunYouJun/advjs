<script setup lang="ts">
import type { CreativeNarrativeConcern, CreativeNarrativeDecision } from '@advjs/agent'
import { useI18n } from 'vue-i18n'
import CreativeNarrativeEvidence from './CreativeNarrativeEvidence.vue'

const props = defineProps<{ concerns: readonly CreativeNarrativeConcern[], decisions: readonly CreativeNarrativeDecision[], disabled: boolean }>()
const emit = defineEmits<{ update: [decisions: CreativeNarrativeDecision[]], source: [path: string, line: number] }>()
const { t } = useI18n()
function update(index: number, status: string, reason: string) {
  if (props.disabled || !['pending', 'confirmed', 'dismissed'].includes(status) || (status === 'confirmed' && !props.concerns[index]?.evidence))
    return
  emit('update', [...props.decisions.filter(item => item.index !== index), ...(status === 'pending' ? [] : [{ index, status: status as 'confirmed' | 'dismissed', reason }])])
}
function selected(index: number) {
  return props.decisions.find(item => item.index === index)
}
</script>

<template>
  <section class="narrative-review" data-testid="creative-narrative-review">
    <h3>{{ t('creativeTeam.playtest.narrative.title') }}</h3>
    <p>{{ t('creativeTeam.playtest.narrative.hint') }}</p>
    <article v-for="(concern, index) in concerns" :key="index" class="narrative-review__item">
      <h4>{{ t('creativeTeam.playtest.narrative.concern', { index: index + 1 }) }}</h4>
      <CreativeNarrativeEvidence :concern="concern" navigable @source="(path, line) => emit('source', path, line)" />
      <label class="narrative-review__field">
        {{ t('creativeTeam.playtest.narrative.decision') }}
        <select :value="selected(index)?.status ?? 'pending'" :disabled="disabled" @change="update(index, ($event.target as HTMLSelectElement).value, selected(index)?.reason ?? '')">
          <option value="pending">{{ t('creativeTeam.playtest.narrative.status.pending') }}</option>
          <option value="confirmed" :disabled="!concern.evidence">{{ t('creativeTeam.playtest.narrative.status.confirmed') }}</option>
          <option value="dismissed">{{ t('creativeTeam.playtest.narrative.status.dismissed') }}</option>
        </select>
      </label>
      <label v-if="selected(index)" class="narrative-review__field">
        {{ t('creativeTeam.playtest.narrative.reason') }}
        <textarea :value="selected(index)?.reason" :disabled="disabled" maxlength="1000" rows="3" required @input="update(index, selected(index)!.status, ($event.target as HTMLTextAreaElement).value)" />
      </label>
    </article>
  </section>
</template>

<style scoped>
.narrative-review {
  margin-block: var(--adv-space-md);
  line-height: 1.6;
}
.narrative-review__item {
  border-top: 1px solid var(--adv-border-subtle);
  padding-block: var(--adv-space-md);
}
.narrative-review__field {
  display: grid;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-sm);
}
.narrative-review__field :is(select, textarea) {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  font: inherit;
  color: var(--adv-text-primary);
  background: var(--adv-surface-card);
}
.narrative-review__field :is(select, textarea):focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
