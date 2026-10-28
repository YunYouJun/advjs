<script setup lang="ts">
import type { CreativeDirectorSummaryOutput } from '@advjs/agent'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CreativeNarrativeReport from './CreativeNarrativeReport.vue'
import CreativePlaytestVoiceReport from './CreativePlaytestVoiceReport.vue'

const props = defineProps<{ output: CreativeDirectorSummaryOutput }>()
const { t, locale } = useI18n()
const evidence = computed(() => props.output.evidence)
const results = computed(() => evidence.value.state.artifacts.map(artifact => ({ ...artifact, assessment: props.output.deliverables.find(item => item.artifactId === artifact.artifactId)?.assessment })))
const reports = computed(() => evidence.value.state.playtests.map(summary => ({ ...summary, detail: evidence.value.reports.find(item => item.id === summary.id), current: summary.snapshotRevision === evidence.value.snapshotRevision })))
const priorPoints = computed(() => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 3 }).format(evidence.value.state.chargedBeforeSummary / 1000))
</script>

<template>
  <section class="director-summary" data-testid="creative-director-summary">
    <p class="director-summary__notice" role="note">
      {{ t('creativeTeam.directorSummary.advice') }}
    </p>
    <h4>{{ t(`creativeTeam.directorSummary.recommendation.${output.recommendation}`) }}</h4>
    <p>{{ output.overview }}</p>
    <dl>
      <dt>{{ t('creativeTeam.directorSummary.projectVersion') }}</dt><dd><code>{{ evidence.projectRevision }}</code></dd>
      <dt>{{ t('creativeTeam.directorSummary.snapshotVersion') }} · {{ t(`creativeTeam.directorSummary.scope.${evidence.scope}`) }}</dt><dd><code>{{ evidence.snapshotRevision }}</code></dd>
    </dl>
    <p>{{ t('creativeTeam.directorSummary.priorCost', { points: priorPoints, calls: evidence.toolCallsBeforeSummary }) }}</p>
    <p class="director-summary__hint">
      {{ t('creativeTeam.directorSummary.ownCost') }}
    </p>
    <h4>{{ t('creativeTeam.directorSummary.results') }}</h4>
    <ul>
      <li v-for="result in results" :key="result.artifactId">
        <strong>{{ result.summary }}</strong> · {{ t(`creativeTeam.roles.${result.partner}`) }} · {{ t(`creativeTeam.candidateStatus.${result.status}`) }}
        <code>{{ result.artifactId }}</code>
        <p>{{ result.assessment }}</p>
      </li>
    </ul>
    <p>{{ t('creativeTeam.directorSummary.pending', { candidates: evidence.state.pendingArtifacts.length, media: evidence.pendingMedia.length }) }}</p>
    <ul v-if="evidence.pendingMedia.length">
      <li v-for="(item, index) in evidence.pendingMedia" :key="index">
        <code>{{ item.target }}</code>
      </li>
    </ul>
    <h4>{{ t('creativeTeam.directorSummary.tasks') }}</h4>
    <ul>
      <li v-for="task in evidence.state.tasks" :key="task.taskId">
        <code>{{ task.taskId }}</code> · {{ t(task.status === 'completed' ? 'creativeTeam.taskSelected' : `creativeTeam.status.${task.status}`) }}
        <p v-if="task.error">
          {{ task.error.code }} · {{ task.error.message }}
        </p>
      </li>
    </ul>
    <h4>{{ t('creativeTeam.directorSummary.reports') }}</h4>
    <p v-if="!reports.length">
      {{ t('creativeTeam.directorSummary.noReports') }}
    </p>
    <article v-for="report in reports" :key="report.id">
      <strong>{{ report.id }}</strong> · {{ t(report.current ? 'creativeTeam.directorSummary.currentReport' : 'creativeTeam.directorSummary.olderReport') }}
      <p><code>{{ report.snapshotRevision }}</code></p>
      <p>{{ t('creativeTeam.delivery.playtestResult', report) }}</p>
      <CreativeNarrativeReport v-if="report.detail?.narrativeReview" :review="report.detail.narrativeReview" />
      <CreativePlaytestVoiceReport v-if="report.detail?.voiceCoverage" :coverage="report.detail.voiceCoverage" />
      <p v-if="!report.detail?.available" class="director-summary__notice">
        {{ t('creativeTeam.directorSummary.reportUnavailable') }}
      </p>
      <ul v-else>
        <li v-for="execution in report.detail.executions" :key="execution.scenario.id">
          {{ execution.scenario.id }} · {{ t(`creativeTeam.directorSummary.outcome.${execution.status}`) }} · {{ execution.code }}
          <p>{{ execution.scenario.expectedEnding }} → {{ execution.actualEnding || '—' }}</p>
        </li>
      </ul>
      <ul v-if="report.detail?.diagnostics.length">
        <li v-for="(diagnostic, index) in report.detail.diagnostics" :key="index">
          {{ diagnostic.code }} · {{ diagnostic.message }}
          <code v-if="diagnostic.path">{{ diagnostic.path }}{{ diagnostic.line ? `:${diagnostic.line}` : '' }}</code>
        </li>
      </ul>
      <p v-if="report.detail?.diagnosticsOmitted">
        {{ t('creativeTeam.directorSummary.omitted', { count: report.detail.diagnosticsOmitted }) }}
      </p>
    </article>
    <h4 v-if="output.risks.length">
      {{ t('creativeTeam.directorSummary.risks') }}
    </h4>
    <ul>
      <li v-for="(risk, index) in output.risks" :key="index">
        {{ risk }}
      </li>
    </ul>
    <h4 v-if="output.nextSteps.length">
      {{ t('creativeTeam.directorSummary.nextSteps') }}
    </h4>
    <ul>
      <li v-for="(step, index) in output.nextSteps" :key="index">
        {{ step }}
      </li>
    </ul>
    <p class="director-summary__notice">
      {{ t('creativeTeam.directorSummary.unverified') }}
    </p>
  </section>
</template>

<style scoped>
.director-summary {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
  overflow-wrap: anywhere;
}
.director-summary p,
.director-summary h4,
.director-summary dl {
  margin: 0;
}
.director-summary ul {
  margin-block: 0;
  padding-inline-start: var(--adv-space-md);
}
.director-summary li,
.director-summary article {
  margin-block: var(--adv-space-sm);
}
.director-summary dd {
  margin-inline-start: 0;
}
.director-summary code {
  display: block;
  font-family: var(--adv-font-mono);
  font-size: var(--adv-font-body-sm);
  white-space: pre-wrap;
}
.director-summary__hint {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}
.director-summary__notice {
  border-inline-start: 3px solid var(--adv-accent);
  padding-inline-start: var(--adv-space-sm);
}
</style>
