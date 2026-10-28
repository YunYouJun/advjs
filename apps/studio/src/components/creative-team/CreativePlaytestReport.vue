<script setup lang="ts">
import type { CreativePlaytestReport } from '@advjs/agent'
import { useI18n } from 'vue-i18n'
import CreativePlaytestVoiceReport from './CreativePlaytestVoiceReport.vue'

defineProps<{ report: CreativePlaytestReport, stale: boolean }>()
defineEmits<{ source: [path: string, line?: number] }>()
const { t } = useI18n()
function sourceLabel(path: string, line?: number) {
  return line ? `${path}:${line}` : path
}
</script>

<template>
  <article class="playtest-report" data-testid="creative-playtest-report">
    <h3 tabindex="-1">
      {{ t('creativeTeam.playtest.report') }}
    </h3>
    <p class="playtest-report__notice">
      {{ t('creativeTeam.playtest.unverified') }}
    </p>
    <p v-if="stale" class="playtest-report__stale" role="status">
      {{ t('creativeTeam.playtest.stale') }}
    </p>
    <p class="playtest-report__version">
      {{ t('creativeTeam.playtest.snapshot') }} · {{ report.snapshotRevision }}
    </p>
    <CreativePlaytestVoiceReport v-if="report.voiceCoverage" :coverage="report.voiceCoverage" navigable @source="(path, line) => $emit('source', path, line)" />
    <p v-else>
      {{ t('creativeTeam.playtest.voice.notChecked') }}
    </p>
    <details v-if="report.diagnostics.length || report.diagnosticsOmitted">
      <summary>{{ t('creativeTeam.playtest.static') }} · {{ report.diagnostics.length }}</summary>
      <ul>
        <li v-for="(diagnostic, index) in report.diagnostics" :key="index">
          <strong>{{ diagnostic.code }}</strong> · {{ diagnostic.message }}
          <button v-if="diagnostic.path" type="button" class="playtest-report__source" @click="$emit('source', diagnostic.path, diagnostic.line)">
            {{ sourceLabel(diagnostic.path, diagnostic.line) }}
          </button>
        </li>
      </ul>
      <p v-if="report.diagnosticsOmitted">
        {{ t('creativeTeam.playtest.omitted', { count: report.diagnosticsOmitted }) }}
      </p>
    </details>
    <section v-for="execution in report.executions" :key="execution.scenario.id" class="playtest-report__execution">
      <h4>{{ execution.scenario.id }} · {{ t(`creativeTeam.playtest.status.${execution.status}`) }}</h4>
      <p>{{ t(`creativeTeam.playtest.code.${execution.code}`) }}</p>
      <dl>
        <dt>{{ t('creativeTeam.playtest.expected') }}</dt><dd>{{ execution.scenario.expectedEnding }}</dd>
        <dt>{{ t('creativeTeam.playtest.actual') }}</dt><dd>{{ execution.actualEnding || execution.terminalAddress || '—' }}</dd>
        <dt>{{ t('creativeTeam.playtest.commands') }}</dt><dd>{{ execution.commands }}</dd>
      </dl>
      <p v-if="execution.error" role="status">
        {{ execution.error.code }} · {{ execution.error.message }}
      </p>
      <details>
        <summary>{{ t('creativeTeam.playtest.trace') }} · {{ execution.trace.length }}</summary>
        <ol class="playtest-report__trace">
          <li v-for="step in execution.trace" :key="step.sequence">
            <strong>{{ step.command }}<template v-if="step.choice"> · {{ step.choice.index }} · {{ step.choice.label }}</template></strong>
            <p>{{ step.address }} · {{ step.status }}</p>
            <p v-if="step.text">
              {{ step.text }}
            </p>
            <button v-if="step.source" type="button" class="playtest-report__source" @click="$emit('source', step.source.path, step.source.line)">
              {{ sourceLabel(step.source.path, step.source.line) }}
            </button>
            <small v-if="step.effects.length">{{ step.effects.join(', ') }}</small>
          </li>
        </ol>
      </details>
    </section>
  </article>
</template>

<style scoped>
.playtest-report {
  margin-top: var(--adv-space-lg);
  line-height: 1.6;
}
.playtest-report__notice {
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-secondary);
}
.playtest-report__stale {
  color: var(--adv-danger);
}
.playtest-report__version,
.playtest-report__trace {
  overflow-wrap: anywhere;
}
.playtest-report__version {
  font-size: var(--adv-font-body-sm);
}
.playtest-report__execution {
  border-top: 1px solid var(--adv-border-subtle);
  margin-top: var(--adv-space-md);
  padding-top: var(--adv-space-md);
}
.playtest-report__execution dl {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--adv-space-xs) var(--adv-space-md);
}
.playtest-report__execution dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.playtest-report__trace {
  max-height: 540px;
  overflow-y: auto;
  padding-left: var(--adv-space-lg);
}
.playtest-report__trace li {
  padding-bottom: var(--adv-space-md);
}
.playtest-report__trace p {
  margin-block: var(--adv-space-xs);
  white-space: pre-wrap;
}
.playtest-report__source {
  display: block;
  border: 0;
  background: transparent;
  color: var(--adv-primary);
  padding: var(--adv-space-xs) 0;
  min-height: 44px;
  cursor: pointer;
  overflow-wrap: anywhere;
  font: inherit;
  text-align: start;
}
.playtest-report summary {
  min-height: 44px;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.playtest-report :is(button, summary):focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
