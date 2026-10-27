<script setup lang="ts">
import type { CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportHost } from '../../composables/useCreativeArtImport'
import { useI18n } from 'vue-i18n'
import { useCreativeVoiceCoverage } from '../../composables/useCreativeVoiceCoverage'
import SButton from '../ui/SButton.vue'
import CreativeVoiceCoverageList from './CreativeVoiceCoverageList.vue'

const props = defineProps<{ run: CreativeTeamRun, disabled: boolean, host: () => Promise<CreativeArtImportHost> }>()
const { t } = useI18n()
const { result, loading, error, filter, query, rows, issues, load } = useCreativeVoiceCoverage({ scope: () => `${props.run.accountId}:${props.run.plan.projectId}:${props.run.id}:${props.run.revision}`, projectId: () => props.run.plan.projectId, host: props.host })
const filters = ['issues', 'all', 'missing', 'unselected', 'stale', 'unavailable', 'ready', 'unresolved'] as const
</script>

<template>
  <section class="voice-coverage" data-testid="creative-voice-coverage">
    <h2 class="voice-coverage__title">
      {{ t('creativeTeam.voiceCoverage.title') }}
    </h2>
    <p>{{ t('creativeTeam.voiceCoverage.hint') }}</p>
    <SButton size="lg" variant="outline" :disabled="disabled" :loading="loading" @click="load">
      {{ t('creativeTeam.voiceCoverage.inspect') }}
    </SButton>
    <p v-if="error" role="alert">
      {{ t('creativeTeam.voiceCoverage.error') }}
    </p>
    <template v-if="result">
      <p role="status">
        {{ t('creativeTeam.voiceCoverage.count', { total: result.rows.length, issues, locale: result.locale }) }}
      </p>
      <p class="voice-coverage__revision">
        {{ t('creativeTeam.source') }} · {{ result.revision }}
      </p>
      <p v-if="!result.complete" role="status">
        {{ t('creativeTeam.voiceCoverage.incomplete') }}
      </p>
      <details v-if="result.diagnostics.length">
        <summary>{{ t('creativeTeam.voiceCoverage.diagnostics') }} · {{ result.diagnostics.length }}</summary>
        <p v-for="(diagnostic, index) in result.diagnostics" :key="index">
          {{ diagnostic.path }}:{{ diagnostic.line }} · {{ diagnostic.code }} · {{ diagnostic.message }}
        </p>
      </details>
      <div class="voice-coverage__filters">
        <label>{{ t('creativeTeam.voiceCoverage.filter') }}<select v-model="filter"><option v-for="value in filters" :key="value" :value="value">{{ t(`creativeTeam.voiceCoverage.status.${value}`) }}</option></select></label>
        <label>{{ t('creativeTeam.voiceCoverage.search') }}<input v-model="query" type="search"></label>
      </div>
      <CreativeVoiceCoverageList :rows="rows" />
      <p v-if="!rows.length">
        {{ t('creativeTeam.voiceCoverage.empty') }}
      </p>
    </template>
  </section>
</template>

<style scoped>
.voice-coverage {
  padding-top: var(--adv-space-lg);
  margin-top: var(--adv-space-lg);
  border-top: 1px solid var(--adv-border-subtle);
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.voice-coverage__title {
  font-size: var(--adv-font-title);
}
.voice-coverage__revision {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}
.voice-coverage__filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-md);
}
.voice-coverage__filters label {
  display: grid;
  flex: 1;
  min-width: min(100%, 200px);
  gap: var(--adv-space-sm);
}
.voice-coverage__filters :is(input, select) {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  font: inherit;
  color: var(--adv-text-primary);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
}
.voice-coverage :is(input, select, summary):focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.voice-coverage summary {
  min-height: 44px;
  cursor: pointer;
}
</style>
