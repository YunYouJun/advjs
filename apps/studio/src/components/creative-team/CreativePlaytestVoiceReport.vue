<script setup lang="ts">
import type { CreativePlaytestVoiceCoverage } from '@advjs/agent'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ coverage: CreativePlaytestVoiceCoverage, navigable?: boolean }>()
defineEmits<{ source: [path: string, line?: number] }>()
const { t } = useI18n()
const matching = computed(() => props.coverage.rows.filter(item => item.status === 'ready').length)
</script>

<template>
  <section class="playtest-voice" data-testid="creative-playtest-voice-report">
    <h4 class="playtest-voice__title">
      {{ t('creativeTeam.playtest.voice.title') }}
    </h4>
    <p>{{ t('creativeTeam.playtest.voice.boundary') }}</p>
    <p>{{ coverage.locale }} · {{ t('creativeTeam.playtest.voice.counts', { recorded: coverage.rows.length, matching }) }}</p>
    <p v-if="!coverage.complete" role="status">
      {{ t('creativeTeam.playtest.voice.incomplete') }}
    </p>
    <p v-if="coverage.rowsOmitted" role="status">
      {{ t('creativeTeam.playtest.voice.omitted', { count: coverage.rowsOmitted }) }}
    </p>
    <ul class="playtest-voice__rows">
      <li v-for="row in coverage.rows" :key="row.address" class="playtest-voice__row">
        <strong>{{ t(`creativeTeam.voiceCoverage.status.${row.status}`) }}</strong> · {{ row.speakerId }}
        <code>{{ row.address }}<template v-if="row.lineId"> · {{ row.lineId }}</template></code>
        <button v-if="navigable && row.source" type="button" class="playtest-voice__source" @click="$emit('source', row.source.path, row.source.line)">
          {{ row.source.path }}{{ row.source.line ? `:${row.source.line}` : '' }}
        </button>
        <code v-else-if="row.source">{{ row.source.path }}{{ row.source.line ? `:${row.source.line}` : '' }}</code>
        <p v-if="row.profileMissing">
          {{ t('creativeTeam.voiceCoverage.profileMissing') }}
        </p>
        <details v-if="row.selected">
          <summary>{{ t('creativeTeam.playtest.voice.selected') }}</summary>
          <code>{{ row.selected.takeId }} · {{ row.selected.assetId }}</code>
          <code>{{ row.selected.sha256 }}</code>
        </details>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.playtest-voice {
  margin-block: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  overflow-wrap: anywhere;
}
.playtest-voice__title {
  margin-block: 0 var(--adv-space-sm);
  font-size: var(--adv-font-body);
}
.playtest-voice__rows {
  padding-inline-start: var(--adv-space-md);
}
.playtest-voice__row {
  margin-block: var(--adv-space-md);
}
.playtest-voice__row code {
  display: block;
  white-space: pre-wrap;
}
.playtest-voice__source {
  border: 0;
  background: transparent;
  color: var(--adv-primary);
  min-height: 44px;
  padding: var(--adv-space-xs) 0;
  cursor: pointer;
  text-align: start;
  font: inherit;
}
.playtest-voice__row summary {
  min-height: 44px;
  cursor: pointer;
}
.playtest-voice__source:focus-visible,
.playtest-voice__row summary:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
