<script setup lang="ts">
import type { CreativePlaytestNarrativeReview } from '@advjs/agent'
import { useI18n } from 'vue-i18n'
import CreativeNarrativeEvidence from './CreativeNarrativeEvidence.vue'

defineProps<{ review: CreativePlaytestNarrativeReview, navigable?: boolean }>()
defineEmits<{ source: [path: string, line: number] }>()
const { t } = useI18n()
</script>

<template>
  <section class="narrative-report" data-testid="creative-narrative-report">
    <h4>{{ t('creativeTeam.playtest.narrative.saved') }}</h4>
    <p>{{ t('creativeTeam.playtest.narrative.historical') }}</p>
    <p class="narrative-report__reference">
      {{ review.artifactId }} · {{ review.fingerprint }}
    </p>
    <article v-for="row in review.rows" :key="row.index" class="narrative-report__item">
      <h5>{{ t('creativeTeam.playtest.narrative.concern', { index: row.index + 1 }) }} · {{ t(`creativeTeam.playtest.narrative.status.${row.decision?.status ?? 'pending'}`) }}</h5>
      <p>{{ t(`creativeTeam.playtest.narrative.source.${row.sourceStatus}`) }}</p>
      <p v-if="row.decision">
        {{ t('creativeTeam.playtest.narrative.reason') }} · {{ row.decision.reason }}
      </p>
      <CreativeNarrativeEvidence :concern="row.concern" :navigable="navigable" @source="(path, line) => $emit('source', path, line)" />
    </article>
    <p v-if="review.rowsOmitted" role="status">
      {{ t('creativeTeam.playtest.narrative.omitted', { count: review.rowsOmitted }) }}
    </p>
  </section>
</template>

<style scoped>
.narrative-report {
  margin-block: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.narrative-report__reference {
  font-size: var(--adv-font-body-sm);
}
.narrative-report__item {
  border-top: 1px solid var(--adv-border-subtle);
  padding-block: var(--adv-space-sm);
}
.narrative-report__item h5 {
  font-size: var(--adv-font-body);
  margin-block: var(--adv-space-sm);
}
</style>
