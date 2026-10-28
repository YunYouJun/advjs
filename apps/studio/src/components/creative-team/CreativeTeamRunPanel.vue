<script setup lang="ts">
import type { CreativeCandidateEditRequest, CreativeTeamDecisionInput, CreativeTeamRun } from '@advjs/agent'
import { canRequestCreativeDirectorSummary, creativeTextEditOutput } from '@advjs/agent'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import CreativeTaskRework from './CreativeTaskRework.vue'
import CreativeTeamArtifactCard from './CreativeTeamArtifactCard.vue'

const props = defineProps<{ run: CreativeTeamRun, busy: boolean, sourceBusy?: boolean, enabled: boolean, authorEditsAvailable: boolean, rawTextEditsAvailable?: boolean, voiceEditsAvailable?: boolean, directorSummaryAvailable?: boolean, savedEditArtifactId?: string, knownCharacterIds?: readonly string[] }>()
defineEmits<{ decide: [decision: CreativeTeamDecisionInput], syncFacts: [], edit: [request: CreativeCandidateEditRequest] }>()
const { t, locale } = useI18n()
const active = computed(() => props.run.tasks.some(task => ['running', 'reconcile_required'].includes(task.status)))
const stopped = computed(() => ['cancelled', 'cancel_requested', 'completed', 'reconcile_required'].includes(props.run.status))
const costs = computed(() => props.run.tasks.reduce((sum, task) => sum + (task.history?.reduce((value, attempt) => value + attempt.usage.providerCostMicroCny, 0) ?? task.usage?.providerCostMicroCny ?? 0), 0))
const tasks = computed(() => props.run.plan.tasks.map((task) => {
  const state = props.run.tasks.find(state => state.taskId === task.id)!
  const summaryAllowed = task.capability !== 'summarize-production' || (Boolean(props.directorSummaryAvailable) && canRequestCreativeDirectorSummary(props.run, task.id))
  const canRework = props.enabled && summaryAllowed && !stopped.value && !active.value && ['failed', 'blocked', 'stale'].includes(state.status) && state.attempt < 1 + props.run.plan.limits.maxReworkRounds
  const reworkExhausted = !stopped.value && ['failed', 'blocked', 'stale'].includes(state.status) && state.attempt >= 1 + props.run.plan.limits.maxReworkRounds
  const canRequestSummary = props.enabled && Boolean(props.directorSummaryAvailable) && state.status === 'pending' && state.attempt === 0 && canRequestCreativeDirectorSummary(props.run, task.id)
  return { ...task, state, canRework, reworkExhausted, canRequestSummary }
}))
const artifacts = computed(() => props.run.artifacts.map((artifact) => {
  const task = props.run.tasks.find(task => task.taskId === artifact.taskId)!
  const canSelect = props.enabled && !stopped.value && artifact.status === 'candidate' && task.status === 'awaiting_review'
  const summaryAllowed = artifact.kind !== 'delivery-summary' || (Boolean(props.directorSummaryAvailable) && canRequestCreativeDirectorSummary(props.run, artifact.taskId))
  const canRework = props.enabled && summaryAllowed && !stopped.value && !active.value && !['stale', 'rejected'].includes(artifact.status)
    && ['awaiting_review', 'completed'].includes(task.status) && task.attempt < 1 + props.run.plan.limits.maxReworkRounds
    && !(artifact.output?.kind === 'production-plan' && artifact.status === 'selected')
  const sourceOutput = creativeTextEditOutput(artifact, props.run.plan.tasks.find(item => item.id === artifact.taskId)?.capability)
  const canEdit = props.authorEditsAvailable && props.run.status !== 'completed' && ['candidate', 'selected'].includes(artifact.status) && ['awaiting_review', 'completed'].includes(task.status)
    && Boolean((sourceOutput && props.rawTextEditsAvailable) || (artifact.output && (['characters', 'chapter'].includes(artifact.output.kind) || (artifact.output.kind === 'voice-direction' && props.voiceEditsAvailable))))
  const editSaved = props.savedEditArtifactId === artifact.id
  return { artifact, sourceOutput, canSelect, canRework, canEdit, editSaved }
}))
function points(value: number) {
  return t('creativeTeam.points', { value: new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(value / 1000) })
}
</script>

<template>
  <section class="team-run">
    <header class="team-run__header">
      <h2 class="team-run__goal">
        {{ run.plan.goal }}
      </h2>
      <p role="status" aria-live="polite">
        {{ t(`creativeTeam.status.${run.status}`) }}
      </p>
    </header>
    <dl class="team-run__budget">
      <div><dt>{{ t('creativeTeam.charged') }}</dt><dd>{{ points(run.chargedMicroPoints) }}</dd></div>
      <div><dt>{{ t('creativeTeam.reserved') }}</dt><dd>{{ points(run.reservedMicroPoints) }}</dd></div>
      <div><dt>{{ t('creativeTeam.remaining') }}</dt><dd>{{ points(Math.max(0, run.plan.limits.maxMicroPoints - run.chargedMicroPoints - run.reservedMicroPoints)) }}</dd></div>
    </dl>
    <p class="team-run__hint">
      {{ t('creativeTeam.cost', { value: (costs / 1000000).toFixed(4) }) }} · {{ t('creativeTeam.limits', { tasks: run.plan.limits.maxTasks, rework: run.plan.limits.maxReworkRounds }) }}
    </p>
    <div v-if="run.status === 'awaiting_plan_review'" class="team-run__approval">
      <p>{{ t('creativeTeam.approveHint') }}</p>
      <SButton size="lg" :disabled="!enabled || sourceBusy" :loading="busy" @click="$emit('decide', { type: 'approve-plan' })">
        {{ t('creativeTeam.approve') }}
      </SButton>
    </div>
    <p v-if="['blocked', 'reconcile_required'].includes(run.status)" role="status" class="team-run__attention">
      {{ t('creativeTeam.attention') }}
    </p>
    <h3>{{ t('creativeTeam.tasks') }}</h3>
    <ol class="team-run__tasks">
      <li v-for="task in tasks" :key="task.id" class="team-run__task">
        <div class="team-run__task-heading">
          <strong>{{ t(`creativeTeam.roles.${task.partner}`) }}</strong><span>{{ t(task.state.status === 'completed' ? 'creativeTeam.taskSelected' : `creativeTeam.status.${task.state.status}`) }}</span>
        </div>
        <p>{{ task.instruction }}</p>
        <p v-if="task.state.playtestRepair" class="team-run__hint" data-testid="creative-repair-reference">
          {{ t('creativeTeam.repair.reference') }} · {{ task.state.playtestRepair.reference.reportId }} · {{ task.state.playtestRepair.reference.findingId }}
        </p>
        <p class="team-run__hint">
          {{ task.expectedOutput }}
        </p>
        <small v-if="task.dependsOn.length">{{ t('creativeTeam.depends') }}: {{ task.dependsOn.join(', ') }}</small>
        <template v-if="task.capability === 'summarize-production'">
          <p class="team-run__hint">
            {{ t(directorSummaryAvailable ? 'creativeTeam.directorSummary.requestHint' : 'creativeTeam.directorSummary.unavailable') }}
          </p>
          <SButton v-if="task.canRequestSummary" size="lg" variant="outline" :loading="busy || sourceBusy" @click="$emit('decide', { type: 'request-rework', taskId: task.id, reason: t('creativeTeam.directorSummary.requestReason') })">
            {{ t('creativeTeam.directorSummary.request') }}
          </SButton>
        </template>
        <CreativeTaskRework v-if="task.canRework" :task-id="task.id" :busy="busy || Boolean(sourceBusy)" :attempt="task.state.attempt" :maximum="1 + run.plan.limits.maxReworkRounds" @request="$emit('decide', $event)" />
        <p v-else-if="task.reworkExhausted" class="team-run__hint" role="status">
          {{ t('creativeTeam.reworkExhausted') }}
        </p>
      </li>
    </ol>
    <h3>{{ t('creativeTeam.artifacts') }}</h3>
    <p v-if="!artifacts.length" class="team-run__hint">
      {{ t('creativeTeam.noArtifacts') }}
    </p>
    <CreativeTeamArtifactCard v-for="item in artifacts" :key="item.artifact.id" v-bind="item" :busy="busy || Boolean(sourceBusy)" :known-character-ids="knownCharacterIds" @decide="$emit('decide', $event)" @edit="$emit('edit', $event)" />
    <div class="team-run__tools">
      <SButton size="lg" variant="outline" :loading="busy" :disabled="!enabled || sourceBusy" @click="$emit('syncFacts')">
        {{ t('creativeTeam.syncFacts') }}
      </SButton>
      <SButton v-if="!['cancelled', 'completed', 'cancel_requested'].includes(run.status)" size="lg" variant="ghost" :loading="busy" @click="$emit('decide', { type: 'cancel', reason: t('creativeTeam.cancelReason') })">
        {{ t('creativeTeam.cancel') }}
      </SButton>
    </div>
    <p class="team-run__hint">
      {{ t('creativeTeam.cancelHint') }}
    </p>
  </section>
</template>

<style scoped>
.team-run {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
}
.team-run__goal {
  font-size: var(--adv-font-title);
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
}
.team-run__header {
  color: var(--adv-text-primary);
}
.team-run__budget {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--adv-space-sm);
  margin: 0;
  padding: var(--adv-space-md);
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-md);
}
.team-run__budget dt {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}
.team-run__budget dd {
  margin: 4px 0 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.team-run__hint {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
}
.team-run__approval,
.team-run__attention {
  border-inline-start: 3px solid var(--adv-accent);
  padding: var(--adv-space-md);
  background: var(--adv-surface-elevated);
}
.team-run__tasks {
  padding-inline-start: 22px;
}
.team-run__task {
  padding: var(--adv-space-sm) 0;
  border-bottom: 1px solid var(--adv-border-subtle);
  overflow-wrap: anywhere;
}
.team-run__task-heading {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
  justify-content: space-between;
}
.team-run__tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-md);
}
@media (max-width: 380px) {
  .team-run__budget {
    padding: var(--adv-space-sm);
    font-size: var(--adv-font-body-sm);
  }
}
</style>
