<script setup lang="ts">
import type { CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import { parseCreativePlaytestScenarios } from '@advjs/agent'
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCreativePlaytest } from '../../composables/useCreativePlaytest'
import { useCreativeTeamStore } from '../../stores/useCreativeTeamStore'
import SButton from '../ui/SButton.vue'
import CreativePlaytestRepairForm from './CreativePlaytestRepairForm.vue'
import CreativePlaytestReport from './CreativePlaytestReport.vue'
import CreativePlaytestScenarios from './CreativePlaytestScenarios.vue'

const props = defineProps<{ run: CreativeTeamRun, busy: boolean, workspace: () => Promise<CreativeProjectWorkspace> }>()
const emit = defineEmits<{ busy: [value: boolean], source: [path: string, line?: number] }>()
const { t } = useI18n()
const store = useCreativeTeamStore()
const session = useCreativePlaytest({ run: () => props.run, workspace: () => props.workspace() })
const { report, entries, activeEntry, busy, repairBusy, error, stale, storedReportId } = session
const scope = shallowRef<'saved' | 'candidate'>('saved')
const scenarios = shallowRef([{ id: 'path-1', expectedEnding: '', choices: '' }])
const inputError = shallowRef(false)
const reportRoot = useTemplateRef<HTMLElement>('reportRoot')
const plan = computed(() => props.run.artifacts.findLast(item => ['candidate', 'selected', 'adopted'].includes(item.status) && item.output?.kind === 'playtest-plan')?.output)
const suggested = computed(() => plan.value?.kind === 'playtest-plan' ? plan.value : undefined)
const hasCandidates = computed(() => props.run.artifacts.some(item => item.status === 'selected' && item.changes.length))
const pending = computed(() => entries.value.filter(item => !item.synced))
const closed = computed(() => props.run.status === 'completed')
const blocked = computed(() => props.busy || busy.value || repairBusy.value)
watch(() => busy.value || repairBusy.value, value => emit('busy', value))
onBeforeUnmount(() => emit('busy', false))
function loadPlan() {
  if (suggested.value)
    scenarios.value = suggested.value.scenarios.map(item => ({ id: item.id, expectedEnding: item.expectedEnding, choices: item.choices.join(', ') }))
}
function reuseInputs() {
  if (report.value) {
    scenarios.value = report.value.executions.map(item => ({ id: item.scenario.id, expectedEnding: item.scenario.expectedEnding, choices: item.scenario.choices.join(', ') }))
    scope.value = report.value.scope === 'candidate' && hasCandidates.value ? 'candidate' : 'saved'
  }
}
async function execute() {
  if (closed.value)
    return
  inputError.value = false
  const previous = report.value
  try {
    const parsed = parseCreativePlaytestScenarios(scenarios.value.map(item => ({ ...item, choices: item.choices.trim() ? item.choices.split(',').map(value => /^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN) : [] })))
    await session.execute(parsed, scope.value === 'candidate')
    if (report.value && report.value !== previous) {
      await nextTick()
      reportRoot.value?.querySelector<HTMLElement>('h3')?.focus()
    }
  }
  catch {
    inputError.value = true
  }
}
async function checkVersion() {
  try {
    await session.checkVersion()
  }
  catch {
    inputError.value = true
  }
}
</script>

<template>
  <section class="playtest" data-testid="creative-playtest">
    <h2>{{ t('creativeTeam.playtest.title') }}</h2>
    <p>{{ t('creativeTeam.playtest.hint') }}</p>
    <p v-if="inputError" role="alert">
      {{ t('creativeTeam.playtest.inputError') }}
    </p>
    <p v-if="error" role="alert">
      {{ t(`creativeTeam.playtest.error.${error}`) }}
    </p>
    <label class="playtest__scope">
      {{ t('creativeTeam.playtest.scope') }}
      <select v-model="scope" :disabled="blocked">
        <option value="saved">{{ t('creativeTeam.playtest.saved') }}</option>
        <option value="candidate" :disabled="!hasCandidates">{{ t('creativeTeam.playtest.candidate') }}</option>
      </select>
    </label>
    <div v-if="suggested" class="playtest__suggestion">
      <SButton variant="outline" size="lg" :disabled="blocked" @click="loadPlan">
        {{ t('creativeTeam.playtest.loadPlan') }}
      </SButton>
      <details v-if="suggested.concerns.length">
        <summary>{{ t('creativeTeam.playtest.concerns') }} · {{ suggested.concerns.length }}</summary>
        <ul>
          <li v-for="(concern, index) in suggested.concerns" :key="index">
            {{ concern.path }}:{{ concern.line }} · {{ concern.actual }} · {{ concern.suggestion }}
          </li>
        </ul>
      </details>
    </div>
    <CreativePlaytestScenarios :scenarios="scenarios" :disabled="blocked" @update="scenarios = $event" />
    <div class="playtest__actions">
      <SButton size="lg" :disabled="blocked || closed" :loading="busy" @click="execute">
        {{ t('creativeTeam.playtest.execute') }}
      </SButton>
      <SButton v-if="busy" size="lg" variant="outline" @click="session.stop">
        {{ t('creativeTeam.playtest.stop') }}
      </SButton>
      <SButton v-if="report" size="lg" variant="ghost" :disabled="blocked" @click="checkVersion">
        {{ t('creativeTeam.playtest.checkVersion') }}
      </SButton>
      <SButton v-if="report" size="lg" variant="outline" :disabled="blocked" @click="reuseInputs">
        {{ t('creativeTeam.playtest.reuse') }}
      </SButton>
    </div>
    <p v-if="activeEntry" role="status">
      {{ t(activeEntry.synced ? 'creativeTeam.playtest.synced' : 'creativeTeam.playtest.local') }}
    </p>
    <SButton v-if="activeEntry && !activeEntry.synced && store.availability?.authoring?.playtestReports" variant="outline" size="lg" :disabled="blocked || closed || stale" @click="session.sync()">
      {{ t('creativeTeam.playtest.sync') }}
    </SButton>
    <details v-if="pending.length || run.playtests?.length" class="playtest__history">
      <summary>{{ t('creativeTeam.playtest.history') }}</summary>
      <ul>
        <li v-for="entry in pending" :key="entry.id">
          <SButton variant="ghost" size="lg" :disabled="blocked" @click="session.open(entry.id)">
            {{ t('creativeTeam.playtest.local') }} · {{ entry.report.snapshotRevision.slice(0, 20) }}
          </SButton>
        </li>
        <li v-for="entry in run.playtests" :key="entry.id">
          <SButton variant="ghost" size="lg" :disabled="blocked" @click="session.open(entry.id)">
            {{ t('creativeTeam.playtest.hostReport') }} · {{ entry.passed }}/{{ entry.passed + entry.failed + entry.blocked + entry.cancelled }} · {{ entry.snapshotRevision.slice(0, 20) }}
          </SButton>
        </li>
      </ul>
    </details>
    <CreativePlaytestRepairForm v-if="report" :report="report" :report-id="storedReportId" :run="run" :busy="blocked" :stale="stale" :enabled="Boolean(!closed && store.availability?.enabled && store.availability.authoring?.playtestRepair)" :capabilities="store.availability?.capabilities ?? []" @request="({ taskId, findingId }) => session.requestRepair(taskId, findingId)" />
    <div ref="reportRoot">
      <CreativePlaytestReport v-if="report" :report="report" :stale="stale" @source="(path, line) => emit('source', path, line)" />
    </div>
  </section>
</template>

<style scoped>
.playtest {
  border-top: 1px solid var(--adv-border-subtle);
  margin-top: var(--adv-space-lg);
  padding-top: var(--adv-space-lg);
  min-width: 0;
  line-height: 1.6;
}
.playtest h2 {
  font-size: var(--adv-font-title);
}
.playtest__scope {
  display: grid;
  gap: var(--adv-space-sm);
  margin-block: var(--adv-space-md);
}
.playtest select {
  box-sizing: border-box;
  min-height: 44px;
  max-width: 100%;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-page);
  font: inherit;
}
.playtest select:focus-visible,
.playtest summary:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.playtest__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-md);
}
.playtest__suggestion,
.playtest__history {
  margin-block: var(--adv-space-md);
}
.playtest summary {
  min-height: 44px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.playtest [role='alert'] {
  color: var(--adv-danger);
}
</style>
