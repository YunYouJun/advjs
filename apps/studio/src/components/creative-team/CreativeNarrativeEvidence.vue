<script setup lang="ts">
import type { CreativeNarrativeConcern } from '@advjs/agent'
import { useI18n } from 'vue-i18n'

defineProps<{ concern: CreativeNarrativeConcern, navigable?: boolean }>()
defineEmits<{ source: [path: string, line: number] }>()
const { t } = useI18n()
</script>

<template>
  <div class="narrative-evidence">
    <p><strong>{{ t('creativeTeam.expectedResult') }}</strong> · {{ concern.expected }}</p>
    <p><strong>{{ t('creativeTeam.actual') }}</strong> · {{ concern.actual }}</p>
    <p>{{ t('creativeTeam.suggestion') }} · {{ concern.suggestion }}</p>
    <template v-if="concern.evidence">
      <blockquote v-for="(quote, kind) in concern.evidence" :key="kind" class="narrative-evidence__quote">
        <strong>{{ t(`creativeTeam.playtest.narrative.quote.${kind}`) }}</strong>
        <button v-if="navigable" type="button" class="narrative-evidence__source" @click="$emit('source', quote.path, quote.line)">
          {{ quote.path }}:{{ quote.line }}–{{ quote.endLine }}
        </button>
        <p v-else>
          {{ quote.path }}:{{ quote.line }}–{{ quote.endLine }}
        </p>
        <pre class="narrative-evidence__text">{{ quote.text }}</pre>
      </blockquote>
    </template>
    <p v-else class="narrative-evidence__hint">
      {{ t('creativeTeam.playtest.narrative.unanchored') }}
    </p>
  </div>
</template>

<style scoped>
.narrative-evidence {
  overflow-wrap: anywhere;
  line-height: 1.6;
}
.narrative-evidence__quote {
  margin: var(--adv-space-sm) 0;
  padding: var(--adv-space-md);
  border-inline-start: 3px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
}
.narrative-evidence__text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font: inherit;
  margin-bottom: 0;
}
.narrative-evidence__source {
  display: block;
  min-height: 44px;
  padding: var(--adv-space-xs) 0;
  border: 0;
  background: transparent;
  color: var(--adv-primary);
  font: inherit;
  text-align: start;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.narrative-evidence__source:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.narrative-evidence__hint {
  color: var(--adv-text-secondary);
}
</style>
