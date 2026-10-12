<script setup lang="ts">
import type { AdvAssetEntry } from '@advjs/types'
import { inspectMusicReview } from '@advjs/audio'
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ asset: AdvAssetEntry, active: boolean, busy: boolean, auditioned?: boolean }>()
const emit = defineEmits<{ review: [status: 'approved' | 'rejected'], bind: [] }>()
const { t } = useI18n()
const confirmed = shallowRef(false)
const state = computed(() => inspectMusicReview(props.asset))
watch(() => JSON.stringify(props.asset), () => confirmed.value = false)
watch(() => props.active, () => confirmed.value = false)
watch(() => props.auditioned, () => confirmed.value = false)
</script>

<template>
  <section class="music-review" data-testid="music-review">
    <p>{{ t('musicWorkflow.usage') }}：{{ t(`musicWorkflow.usages.${asset.music?.usage ?? 'background'}`) }} · {{ t(`musicWorkflow.states.${state.status}`) }}</p>
    <template v-if="asset.music">
      <p v-if="asset.music.brief">
        {{ asset.music.brief.summary }}
      </p>
      <p>{{ t('musicWorkflow.provenance') }}：{{ t(`musicWorkflow.sources.${asset.music.source.type}`) }}<span v-if="asset.music.source.tool"> · {{ asset.music.source.tool }}</span></p>
      <a v-if="asset.music.source.url" :href="asset.music.source.url" target="_blank" rel="noopener noreferrer">{{ t('musicWorkflow.openSource') }}</a>
      <code>SHA-256: {{ asset.sha256 }}</code>
      <p>{{ t('musicWorkflow.approveHint') }}</p>
      <label><input v-model="confirmed" type="checkbox" :disabled="busy || !active || !auditioned">{{ t('musicWorkflow.confirmReview') }}</label>
      <div class="music-review__actions">
        <SButton size="lg" :disabled="busy || !active || !confirmed || !auditioned || !asset.sha256 || !asset.music.rights?.license" @click="emit('review', 'approved')">
          {{ t('musicWorkflow.approve') }}
        </SButton>
        <SButton size="lg" variant="ghost" :disabled="busy || !active || !asset.sha256" @click="emit('review', 'rejected')">
          {{ t('musicWorkflow.reject') }}
        </SButton>
      </div>
    </template>
    <p v-else>
      {{ t('musicWorkflow.legacyHint') }}
    </p>
    <SButton size="lg" variant="outline" :disabled="busy || !active || !state.canBind" @click="emit('bind')">
      {{ t('musicWorkflow.bindChapter') }}
    </SButton>
  </section>
</template>

<style scoped>
.music-review {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
}
.music-review p,
.music-review code {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
}
.music-review a {
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--adv-primary);
}
.music-review label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  min-height: 44px;
}
.music-review input {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  accent-color: var(--adv-primary);
}
.music-review input[type='checkbox']:focus-visible {
  outline: 3px solid var(--adv-primary);
  outline-offset: 2px;
}
.music-review__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
}
.music-review :deep(.s-button) {
  white-space: normal;
}
</style>
