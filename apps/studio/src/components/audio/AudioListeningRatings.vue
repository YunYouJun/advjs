<script setup lang="ts">
import type { createVoiceListeningSession, setVoiceListeningSampleReview, voiceListeningAnonymousSamples, VoiceListeningCandidate, VoiceListeningScore } from '@advjs/audio'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import SSelect from '../ui/SSelect.vue'

const _props = defineProps<{ samples: ReturnType<typeof createVoiceListeningSession>['samples'], anonymous: ReturnType<typeof voiceListeningAnonymousSamples>, activeAssetId?: string, disabled: boolean, stylesBySpeaker?: Record<string, string> }>()
const emit = defineEmits<{ preview: [candidate: VoiceListeningCandidate, label: string], review: [id: string, patch: Parameters<typeof setVoiceListeningSampleReview>[2]] }>()
const { t } = useI18n()
const options = ['pending', 'na', '1', '2', '3', '4', '5'].map(value => ({ value, label: t(`voiceListening.rating.${value}`) }))
function score(sample: typeof _props.samples[number], dimension: keyof typeof sample.scores, value: string) {
  emit('review', sample.id, { scores: { ...sample.scores, [dimension]: value === 'pending' ? null : value === 'na' ? 'na' : Number(value) as VoiceListeningScore } })
}
</script>

<template>
  <div class="listening-ratings">
    <article v-for="sample in samples" :key="sample.id" class="listening-ratings__sample">
      <header>
        <h3>{{ sample.id }} · {{ anonymous.find(value => value.id === sample.id)?.groupId }}</h3><SButton size="lg" variant="outline" :disabled="disabled" :aria-pressed="activeAssetId === sample.candidate.assetId" @click="emit('preview', sample.candidate, sample.id)">
          {{ t('voiceListening.listenSample', { sample: sample.id }) }}
        </SButton>
      </header>
      <p>{{ sample.candidate.spokenText }}</p>
      <details class="listening-ratings__target">
        <summary>{{ t('voiceListening.currentStyle') }}</summary><p>{{ stylesBySpeaker?.[sample.candidate.speakerId] || t('voiceListening.noStyle') }}</p><p v-if="sample.candidate.stale">
          {{ t('voiceListening.historicalStyle') }}
        </p>
      </details>
      <p class="listening-ratings__hint">
        {{ t('voiceListening.coverageHint') }}
      </p>
      <div class="listening-ratings__scores">
        <label v-for="dimension in Object.keys(sample.scores) as Array<keyof typeof sample.scores>" :key="dimension">
          <span>{{ t(`voiceListening.dimension.${dimension}`) }}</span>
          <SSelect size="lg" :model-value="sample.scores[dimension] === null ? 'pending' : String(sample.scores[dimension])" :aria-label="`${sample.id} ${t(`voiceListening.dimension.${dimension}`)}`" :options="options" @update:model-value="score(sample, dimension, $event)" />
        </label>
      </div>
      <label class="listening-ratings__notes"><span>{{ t('voiceListening.notes') }}</span><textarea :value="sample.notes" rows="2" maxlength="4000" @input="emit('review', sample.id, { notes: ($event.target as HTMLTextAreaElement).value })" /></label>
    </article>
  </div>
</template>

<style scoped>
.listening-ratings {
  display: grid;
  gap: var(--adv-space-md);
}
.listening-ratings__sample {
  display: grid;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  min-width: 0;
}
.listening-ratings__sample header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
  flex-wrap: wrap;
}
.listening-ratings__sample h3,
.listening-ratings__sample p {
  margin: 0;
  overflow-wrap: anywhere;
}
.listening-ratings__hint {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}
.listening-ratings__scores {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--adv-space-md);
}
.listening-ratings__scores label,
.listening-ratings__notes {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
}
.listening-ratings__notes textarea {
  min-height: 48px;
  width: 100%;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
  font: inherit;
  resize: vertical;
}
.listening-ratings__notes textarea:focus-visible {
  outline: 2px solid var(--adv-primary);
  outline-offset: 2px;
}
@media (min-width: 768px) {
  .listening-ratings__scores {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.listening-ratings__target summary {
  display: flex;
  align-items: center;
  min-height: 48px;
  cursor: pointer;
}
</style>
