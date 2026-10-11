<script setup lang="ts">
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { studioVoiceReviewRows } from '../../utils/audioWorkspace'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'

const props = defineProps<{ snapshot: VoiceAuthoringSnapshot, busy: boolean }>()
const emit = defineEmits<{
  preview: [assetId: string]
  select: [lineId: string, locale: string, takeId: string | null, replaceSelected: boolean]
}>()
const { t } = useI18n()
const locale = shallowRef('all')
const status = shallowRef('all')
const query = shallowRef('')
const rows = computed(() => studioVoiceReviewRows(props.snapshot))
const locales = computed(() => [{ value: 'all', label: t('audioWorkspace.allLocales') }, ...[...new Set(rows.value.map(row => row.locale))].map(value => ({ value, label: value }))])
const statuses = computed(() => ['all', 'selected', 'unselected', 'stale'].map(value => ({ value, label: t(`audioWorkspace.reviewStatus.${value}`) })))
const filtered = computed(() => rows.value.filter(row => (locale.value === 'all' || row.locale === locale.value)
  && (status.value === 'all' || (status.value === 'selected' && row.selectedTake) || (status.value === 'unselected' && !row.selectedTake) || (status.value === 'stale' && row.takes.some(take => take.stale)))
  && (!query.value.trim() || `${row.speakerId} ${row.displayText} ${row.lineId}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))))
</script>

<template>
  <section class="voice-review" aria-labelledby="voice-review-title">
    <h2 id="voice-review-title" class="voice-review__title">
      {{ t('audioWorkspace.reviewTitle') }}
    </h2>
    <p class="voice-review__hint">
      {{ t('audioWorkspace.reviewHint') }}
    </p>
    <div class="voice-review__filters">
      <SInput v-model="query" size="lg" :placeholder="t('audioWorkspace.searchDialogue')" :aria-label="t('audioWorkspace.searchDialogue')" />
      <SSelect v-model="locale" size="lg" :options="locales" :aria-label="t('audioWorkspace.localeFilter')" />
      <SSelect v-model="status" size="lg" :options="statuses" :aria-label="t('audioWorkspace.statusFilter')" />
    </div>
    <p v-if="!filtered.length" class="voice-review__hint">
      {{ t('audioWorkspace.noTakes') }}
    </p>
    <article v-for="row in filtered" :key="`${row.lineId}/${row.locale}`" class="voice-review__line">
      <header class="voice-review__line-header">
        <strong>{{ row.speakerId }}</strong><span class="voice-review__locale">{{ row.locale }}</span>
      </header>
      <p class="voice-review__text">
        {{ row.displayText }}
      </p>
      <p v-if="row.spokenText !== row.displayText" class="voice-review__hint">
        {{ t('audioWorkspace.spokenText') }}: {{ row.spokenText }}
      </p>
      <code class="voice-review__id">{{ row.lineId }}</code>
      <div v-for="take in row.takes" :key="take.id" class="voice-review__take" :class="{ 'voice-review__take--selected': take.selected }">
        <div class="voice-review__take-header">
          <strong>{{ take.selected ? t('audioWorkspace.selected') : t('audioWorkspace.history') }}</strong>
          <span v-if="take.stale || take.unavailable" class="voice-review__warning">{{ t(take.unavailable ? 'audioWorkspace.unavailable' : 'audioWorkspace.stale') }}</span>
        </div>
        <p class="voice-review__text">
          {{ take.spokenText }}
        </p>
        <p class="voice-review__hint">
          {{ take.providerId }} · {{ take.model }} · {{ take.voiceId }}
        </p>
        <p class="voice-review__hint">
          {{ t(`audioWorkspace.source.${take.source}`) }} · {{ new Date(take.createdAt).toLocaleString() }}
        </p>
        <p v-if="take.rights" class="voice-review__hint">
          {{ take.rights.license }} · {{ take.rights.subject }} · {{ take.rights.consentRecord }}
        </p>
        <details class="voice-review__provenance">
          <summary>{{ t('audioWorkspace.provenance') }}</summary>
          <code>{{ take.id }}</code><code>{{ take.assetId }}</code><code>SHA-256: {{ take.sha256 }}</code><code>{{ take.inputFingerprint }}</code>
        </details>
        <div class="voice-review__actions">
          <SButton size="lg" variant="secondary" :disabled="busy || take.unavailable" @click="emit('preview', take.assetId)">
            {{ t('audioWorkspace.preview') }}
          </SButton>
          <SButton v-if="!take.selected" size="lg" :disabled="busy || take.unavailable" @click="emit('select', row.lineId, row.locale, take.id, row.selectedTake !== null)">
            {{ row.selectedTake ? t('audioWorkspace.replaceSelected') : t('audioWorkspace.bind') }}
          </SButton>
          <SButton v-else size="lg" variant="outline" :disabled="busy" @click="emit('select', row.lineId, row.locale, null, true)">
            {{ t('audioWorkspace.clearSelected') }}
          </SButton>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.voice-review {
  display: grid;
  gap: var(--adv-space-md);
}
.voice-review__title {
  margin: 0;
  font-size: var(--adv-font-title);
}
.voice-review__hint {
  margin: 0;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  overflow-wrap: anywhere;
}
.voice-review__filters {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 1fr;
}
.voice-review__filters > :first-child {
  grid-column: 1 / -1;
}
.voice-review__line {
  display: grid;
  gap: 12px;
  border: 1px solid var(--adv-border-subtle);
  padding: 16px;
  border-radius: var(--adv-radius-md);
  min-width: 0;
}
.voice-review__line-header,
.voice-review__take-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.voice-review__locale {
  border-radius: var(--adv-radius-full);
  padding: 4px 8px;
  background: var(--adv-surface-elevated);
  font-size: var(--adv-font-body-sm);
}
.voice-review__text {
  margin: 0;
  overflow-wrap: anywhere;
}
.voice-review__id {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-secondary);
  overflow-wrap: anywhere;
}
.voice-review__take {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: var(--adv-surface-elevated);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  min-width: 0;
}
.voice-review__take--selected {
  border-color: var(--adv-primary);
}
.voice-review__warning {
  color: var(--adv-accent);
  font-size: var(--adv-font-body-sm);
}
.voice-review__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.voice-review__provenance {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-caption);
}
.voice-review__provenance summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
}
.voice-review__provenance code {
  display: block;
  overflow-wrap: anywhere;
  padding: 4px 0;
}
</style>
