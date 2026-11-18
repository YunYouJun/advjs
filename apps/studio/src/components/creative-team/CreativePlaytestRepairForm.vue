<script setup lang="ts">
import type { CreativePlaytestReport, CreativeTeamRun } from '@advjs/agent'
import { creativePlaytestFindings } from '@advjs/agent'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ report: CreativePlaytestReport, reportId?: string, run: CreativeTeamRun, busy: boolean, stale: boolean, enabled: boolean, capabilities: readonly string[] }>()
const emit = defineEmits<{ request: [value: { taskId: string, findingId: string }] }>()
const { t } = useI18n()
const findingId = shallowRef('')
const taskId = shallowRef('')
const findings = computed(() => creativePlaytestFindings(props.report))
const owners = computed(() => props.run.plan.tasks.filter(task => !['director', 'playtester'].includes(task.partner) && props.capabilities.includes(task.capability)).filter(task => props.run.tasks.some(state => state.taskId === task.id && ['failed', 'blocked', 'stale', 'awaiting_review', 'completed'].includes(state.status) && state.attempt < 1 + props.run.plan.limits.maxReworkRounds)))
const selected = computed(() => findings.value.find(item => item.id === findingId.value))
const disabled = computed(() => props.busy || props.stale || !props.enabled || !props.reportId || props.run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)) || ['completed', 'cancel_requested', 'cancelled', 'reconcile_required'].includes(props.run.status) || props.run.milestones?.some(item => item.status === 'prepared'))
watch(() => props.report, () => {
  findingId.value = ''
  taskId.value = ''
})
function submit() {
  if (!disabled.value && selected.value && owners.value.some(item => item.id === taskId.value))
    emit('request', { taskId: taskId.value, findingId: findingId.value })
}
</script>

<template>
  <form v-if="findings.length" class="repair" data-testid="creative-playtest-repair" @submit.prevent="submit">
    <h3 class="repair__title">
      {{ t('creativeTeam.repair.title') }}
    </h3>
    <p>{{ t('creativeTeam.repair.hint') }}</p>
    <p v-if="disabled || !owners.length" role="status">
      {{ t('creativeTeam.repair.unavailable') }}
    </p>
    <label class="repair__field">
      {{ t('creativeTeam.repair.finding') }}
      <select v-model="findingId" class="repair__input" :disabled="disabled" required>
        <option value="" disabled>{{ t('creativeTeam.repair.finding') }}</option>
        <option v-for="finding in findings" :key="finding.id" :value="finding.id">{{ finding.code }} · {{ finding.source?.path ?? finding.scenario?.id }}</option>
      </select>
    </label>
    <p v-if="selected" class="repair__observation">
      {{ selected.actual }}
    </p>
    <label class="repair__field">
      {{ t('creativeTeam.repair.owner') }}
      <select v-model="taskId" class="repair__input" :disabled="disabled" required>
        <option value="" disabled>{{ t('creativeTeam.repair.owner') }}</option>
        <option v-for="task in owners" :key="task.id" :value="task.id">{{ t(`creativeTeam.roles.${task.partner}`) }} · {{ task.id }}</option>
      </select>
    </label>
    <SButton variant="outline" size="lg" type="submit" :disabled="disabled || !selected || !owners.some(item => item.id === taskId)" :loading="busy">
      {{ t('creativeTeam.repair.submit') }}
    </SButton>
  </form>
</template>

<style scoped>
.repair {
  display: grid;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
  margin-block: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  overflow-wrap: anywhere;
}
.repair__title {
  margin: 0;
  font-size: var(--adv-font-body);
}
.repair__field {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
}
.repair__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  font: inherit;
  color: var(--adv-text-primary);
  background: var(--adv-surface-page);
}
.repair__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.repair__observation {
  color: var(--adv-text-secondary);
}
</style>
