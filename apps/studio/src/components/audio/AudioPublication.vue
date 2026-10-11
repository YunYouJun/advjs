<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAudioPublication } from '../../composables/useAudioPublication'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ active: boolean }>()
const { t } = useI18n()
const api = useAudioPublication(toRef(props, 'active'))
const { review, current, busy, error, canReview, loginRequired, configured } = api
const size = computed(() => ((review.value?.bytes ?? 0) / 1024 / 1024).toFixed(2))
const errorText = computed(() => t(`audioPublication.errors.${error.value}`, t('audioPublication.failed')))
</script>

<template>
  <section class="audio-publication" data-testid="audio-publication" :aria-busy="busy">
    <div class="audio-publication__heading">
      <div>
        <h2>{{ t('audioPublication.title') }}</h2>
        <p>{{ t('audioPublication.hint') }}</p>
      </div>
      <SButton variant="outline" size="lg" :disabled="!canReview" @click="api.refresh">
        {{ t('audioPublication.refresh') }}
      </SButton>
    </div>
    <p v-if="!configured" class="audio-publication__notice">
      {{ t('audioPublication.configure') }}
    </p>
    <p v-else-if="loginRequired" class="audio-publication__notice">
      {{ t('audioPublication.login') }}
    </p>
    <p v-if="error" class="audio-publication__error" role="alert">
      {{ errorText }}
    </p>
    <SButton size="lg" variant="outline" :loading="busy && !review" :disabled="!canReview" @click="api.prepare">
      {{ t('audioPublication.review') }}
    </SButton>
    <div v-if="review" class="audio-publication__review" data-testid="audio-publication-review">
      <p>{{ t('audioPublication.summary', { assets: review.assetCount, files: review.objectCount, size }) }}</p>
      <ul>
        <li v-for="asset in review.assets" :key="asset.id">
          {{ asset.title }} · {{ t(`audioWorkspace.kind.${asset.kind}`, asset.kind) }}
        </li>
      </ul>
      <SButton size="lg" :loading="busy" :disabled="!canReview" @click="api.publish">
        {{ t('audioPublication.publish') }}
      </SButton>
    </div>
    <p v-if="current" class="audio-publication__result" role="status">
      {{ t('audioPublication.published') }}
      <a :href="current.manifestUrl" target="_blank" rel="noopener noreferrer">{{ t('audioPublication.openManifest') }}</a>
    </p>
  </section>
</template>

<style scoped>
.audio-publication {
  display: grid;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
}
.audio-publication__heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
}
.audio-publication__heading h2 {
  margin: 0;
  font-size: var(--adv-font-subtitle);
}
.audio-publication__heading p,
.audio-publication__notice {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}
.audio-publication__review {
  display: grid;
  gap: var(--adv-space-sm);
}
.audio-publication__review ul {
  margin: 0;
  padding-left: var(--adv-space-lg);
  overflow-wrap: anywhere;
}
.audio-publication__error {
  color: var(--adv-color-danger);
}
.audio-publication__result {
  color: var(--adv-text-primary);
  overflow-wrap: anywhere;
}
.audio-publication__result a {
  color: var(--adv-color-primary);
}
</style>
