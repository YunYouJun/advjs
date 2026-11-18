<script setup lang="ts">
import type { CreativeVoiceCoverageRow } from '../../utils/creativeVoiceCoverage'
import { useI18n } from 'vue-i18n'
import { voiceWorkflowLocation } from '../../utils/voiceWorkflow'

defineProps<{ rows: readonly CreativeVoiceCoverageRow[] }>()
const { t } = useI18n()
</script>

<template>
  <ol class="voice-coverage-list">
    <li v-for="row in rows" :key="row.address" class="voice-coverage-list__row" data-testid="creative-voice-coverage-row">
      <strong>{{ row.speakerId }} · {{ t(`creativeTeam.voiceCoverage.status.${row.status}`) }}</strong>
      <p>{{ row.text }}</p>
      <p>{{ row.path ?? row.address }}<span v-if="row.line">:{{ row.line }}</span> · {{ row.address }}</p>
      <code v-if="row.lineId">{{ row.lineId }}</code>
      <p v-if="row.profileMissing" class="voice-coverage-list__hint">
        {{ t('creativeTeam.voiceCoverage.profileMissing') }}
      </p>
      <div v-if="row.lineId && row.status !== 'unresolved'" class="voice-coverage-list__links">
        <RouterLink :to="voiceWorkflowLocation('jobs', row.speakerId, row.lineId)">
          {{ t('creativeTeam.voiceImport.jobs') }}
        </RouterLink>
        <RouterLink :to="voiceWorkflowLocation('review', row.speakerId, row.lineId)">
          {{ t('creativeTeam.voiceImport.review') }}
        </RouterLink>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.voice-coverage-list {
  padding-inline-start: var(--adv-space-lg);
}
.voice-coverage-list__row {
  padding-block: var(--adv-space-md);
  border-bottom: 1px solid var(--adv-border-subtle);
  overflow-wrap: anywhere;
}
.voice-coverage-list__hint {
  color: var(--adv-text-secondary);
}
.voice-coverage-list__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-md);
}
.voice-coverage-list__links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--adv-primary);
}
.voice-coverage-list__links a:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
