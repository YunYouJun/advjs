<script setup lang="ts">
import type { VoiceListeningCandidate, VoiceReviewContext, VoiceReviewRow } from '@advjs/audio'
import type { VoiceAuthoringSnapshot } from '@advjs/types'
import type { StudioVoicePlayback } from '../../composables/useStudioVoiceListening'
import { compareVoiceListeningCandidates, voiceListeningAdoptionEligibility, voiceListeningCandidate } from '@advjs/audio'
import { computed, defineAsyncComponent, onScopeDispose, ref, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { studioVoiceReviewRows } from '../../utils/audioWorkspace'
import SButton from '../ui/SButton.vue'
import SInput from '../ui/SInput.vue'
import SSelect from '../ui/SSelect.vue'

const props = withDefaults(defineProps<{ snapshot: VoiceAuthoringSnapshot, context?: VoiceReviewContext, busy: boolean, active?: boolean, projectId?: string, scopeKey?: string, activeAssetId?: string, speakerId?: string, lineId?: string, verifyRetained?: (input: { lineId: string, locale: string, takeId: string, expectedRevision: string }) => Promise<boolean> }>(), { active: true, projectId: 'local-project', scopeKey: 'local-project', activeAssetId: '' })
const emit = defineEmits<{ preview: [assetId: string, sha256: string, text: string, label?: string], select: [lineId: string, locale: string, takeId: string | null, replaceSelected: boolean], stop: [] }>()
const AudioAdvancedListening = defineAsyncComponent(() => import('./AudioAdvancedListening.vue'))
const advanced = useTemplateRef<{ observe: (event: StudioVoicePlayback) => void, invalidate: () => void }>('advanced')
const { t } = useI18n()
const locale = shallowRef('all')
const status = shallowRef('all')
const query = shallowRef('')
const rows = shallowRef<VoiceReviewRow[]>([])
const reviewing = shallowRef(false)
const reviewError = shallowRef('')
const pairs = ref<Record<string, { a: string, b: string }>>({})
const pending = shallowRef<{ row: VoiceReviewRow, candidate: VoiceReviewRow['takes'][number], revision: string, confirmed: boolean }>()
const acknowledged = ref<Record<string, boolean>>({})
const confirming = shallowRef(false)
const advancedOpened = shallowRef(false)
const advancedVisible = shallowRef(false)
const advancedCandidates = shallowRef<VoiceListeningCandidate[]>([])
const projectCandidates = computed(() => rows.value.flatMap(row => row.takes.filter(take => !take.unavailable).map(take => candidate(row, take.id))))
const stylesBySpeaker = computed(() => Object.fromEntries(Object.entries({ ...props.context?.profiles, narrator: props.snapshot.narratorProfile }).map(([speaker, profile]) => [speaker, Object.values(profile?.intent ?? {}).map(value => Array.isArray(value) ? value.join(', ') : value).filter(Boolean).join(' · ')])))
let reviewSequence = 0
function rowKey(row: VoiceReviewRow) {
  return `${row.lineId}/${row.locale}`
}
function candidate(row: VoiceReviewRow, takeId: string) {
  const take = row.takes.find(take => take.id === takeId)
  const duration = props.snapshot.catalog.assets.find(asset => asset.id === take?.assetId)?.duration
  return voiceListeningCandidate(row, takeId, duration)
}
function pool(row: VoiceReviewRow) {
  const text = row.takes.find(take => take.id === pairs.value[rowKey(row)]?.a)?.spokenText
  return row.takes.filter(take => !take.unavailable && take.spokenText === text).map(take => candidate(row, take.id))
}
function comparison(row: VoiceReviewRow) {
  const pair = pairs.value[rowKey(row)]
  return compareVoiceListeningCandidates(pair ? [candidate(row, pair.a), candidate(row, pair.b)] : [])
}
function changePair(row: VoiceReviewRow, side: 'a' | 'b', id: string) {
  emit('stop')
  pairs.value[rowKey(row)]![side] = id
  pending.value = undefined
}
function preview(row: VoiceReviewRow, takeId: string) {
  if (!props.active)
    return
  const value = candidate(row, takeId)
  emit('preview', value.assetId, value.sha256, value.spokenText)
}
function requestSelection(row: VoiceReviewRow, take: VoiceReviewRow['takes'][number]) {
  if (props.busy || reviewing.value || !props.active || take.unavailable)
    return
  emit('stop')
  pending.value = { row, candidate: take, revision: props.snapshot.revision, confirmed: false }
}
async function confirmSelection() {
  const value = pending.value
  if (!value || !value.confirmed || value.revision !== props.snapshot.revision || props.busy || reviewing.value || confirming.value || !props.active)
    return
  if (!voiceListeningAdoptionEligibility(candidate(value.row, value.candidate.id), { staleReviewed: value.confirmed }).eligible)
    return
  if (value.candidate.selected) {
    confirming.value = true
    const context = JSON.stringify(props.context)
    let verified = false
    try {
      verified = Boolean(await props.verifyRetained?.({ lineId: value.row.lineId, locale: value.row.locale, takeId: value.candidate.id, expectedRevision: value.revision }))
    }
    catch { verified = false }
    finally { confirming.value = false }
    if (!verified || pending.value !== value || !props.active || props.snapshot.revision !== value.revision || JSON.stringify(props.context) !== context)
      return
    acknowledged.value[`${rowKey(value.row)}/${value.candidate.id}`] = true
  }
  else {
    emit('select', value.row.lineId, value.row.locale, value.candidate.id, value.row.selectedTake !== null)
  }
  pending.value = undefined
}
function openAdvanced(row: VoiceReviewRow) {
  emit('stop')
  advancedCandidates.value = pool(row)
  advancedOpened.value = true
  advancedVisible.value = true
}
function observe(event: StudioVoicePlayback) {
  if (props.active && advancedVisible.value)
    advanced.value?.observe(event)
}
function invalidate() {
  advanced.value?.invalidate()
}
defineExpose({ observe, invalidate })
watch([() => props.snapshot, () => props.context], async () => {
  pending.value = undefined
  acknowledged.value = {}
  emit('stop')
  const current = ++reviewSequence
  reviewing.value = true
  reviewError.value = ''
  try {
    const value = await studioVoiceReviewRows(props.snapshot, props.context)
    if (current !== reviewSequence)
      return
    rows.value = value
    for (const row of value) {
      const available = row.takes.filter(take => !take.unavailable)
      const first = available.find(take => take.selected) ?? available[0]
      const second = available.find(take => take.id !== first?.id && take.spokenText === first?.spokenText) ?? available.find(take => take.id !== first?.id)
      if (first && second && (!pairs.value[rowKey(row)] || !available.some(take => take.id === pairs.value[rowKey(row)]!.a) || !available.some(take => take.id === pairs.value[rowKey(row)]!.b)))
        pairs.value[rowKey(row)] = { a: first.id, b: second.id }
      if (available.length < 2)
        delete pairs.value[rowKey(row)]
    }
  }
  catch {
    if (current === reviewSequence) {
      rows.value = []
      reviewError.value = 'VOICE_REVIEW_FAILED'
    }
  }
  finally {
    if (current === reviewSequence)
      reviewing.value = false
  }
}, { immediate: true, deep: true })
watch([locale, status, query, () => props.active, () => props.scopeKey, () => props.speakerId, () => props.lineId], () => {
  emit('stop')
  pending.value = undefined
}, { flush: 'sync' })
watch(() => props.scopeKey, () => {
  advancedOpened.value = false
  advancedVisible.value = false
  advancedCandidates.value = []
  pairs.value = {}
}, { flush: 'sync' })
watch(advancedVisible, () => emit('stop'), { flush: 'sync' })
onScopeDispose(() => {
  reviewSequence++
  emit('stop')
})
const locales = computed(() => [{ value: 'all', label: t('audioWorkspace.allLocales') }, ...[...new Set(rows.value.map(row => row.locale))].map(value => ({ value, label: value }))])
const statuses = computed(() => ['all', 'selected', 'unselected', 'stale'].map(value => ({ value, label: t(`audioWorkspace.reviewStatus.${value}`) })))
const filtered = computed(() => rows.value.filter(row => (locale.value === 'all' || row.locale === locale.value)
  && (!props.speakerId || row.speakerId === props.speakerId) && (!props.lineId || row.lineId === props.lineId)
  && (status.value === 'all' || (status.value === 'selected' && row.selectedTake) || (status.value === 'unselected' && !row.selectedTake) || (status.value === 'stale' && row.takes.some(take => take.stale)))
  && (!query.value.trim() || `${row.speakerId} ${row.displayText} ${row.lineId}`.toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase()))))
</script>

<template>
  <section class="voice-review" aria-labelledby="voice-review-title" :aria-busy="reviewing">
    <h2 id="voice-review-title" class="voice-review__title">
      {{ t('audioWorkspace.reviewTitle') }}
    </h2>
    <p class="voice-review__hint">
      {{ t('voiceListening.dailyHint') }}
    </p>
    <p v-if="reviewError" class="voice-review__warning" role="alert">
      {{ reviewError }}
    </p>
    <div class="voice-review__filters">
      <SInput v-model="query" size="lg" :placeholder="t('audioWorkspace.searchDialogue')" :aria-label="t('audioWorkspace.searchDialogue')" />
      <SSelect v-model="locale" size="lg" :options="locales" :aria-label="t('audioWorkspace.localeFilter')" />
      <SSelect v-model="status" size="lg" :options="statuses" :aria-label="t('audioWorkspace.statusFilter')" />
    </div>
    <p v-if="!filtered.length" class="voice-review__hint">
      {{ t('audioWorkspace.noTakes') }}
    </p>
    <article v-for="row in filtered" :key="rowKey(row)" class="voice-review__line">
      <header class="voice-review__line-header">
        <strong>{{ row.speakerId }}</strong><span class="voice-review__locale">{{ row.locale }}</span><span>{{ row.selectedTake ? t('audioWorkspace.selected') : t('voiceListening.unbound') }}</span>
      </header>
      <p class="voice-review__text">
        {{ row.displayText }}
      </p>
      <p v-if="row.spokenText !== row.displayText" class="voice-review__hint">
        {{ t('audioWorkspace.spokenText') }}: {{ row.spokenText }}
      </p>
      <section v-if="pairs[rowKey(row)]" class="voice-review__compare" :aria-label="t('voiceListening.compareTitle')">
        <strong>{{ t('voiceListening.compareTitle') }}</strong>
        <div v-for="side in ['a', 'b'] as const" :key="side" class="voice-review__compare-side">
          <SSelect size="lg" :model-value="pairs[rowKey(row)]![side]" :aria-label="t('voiceListening.candidateSide', { side: side.toUpperCase() })" :options="row.takes.filter(take => !take.unavailable).map((take, index) => ({ value: take.id, label: `${index + 1} · ${take.selected ? t('audioWorkspace.selected') : t('audioWorkspace.history')}${take.stale ? ` · ${t('audioWorkspace.stale')}` : ''}` }))" @update:model-value="changePair(row, side, $event)" />
          <SButton size="lg" variant="outline" :disabled="busy || reviewing || !active || !comparison(row).eligible" @click="preview(row, pairs[rowKey(row)]![side])">
            {{ t('voiceListening.listenSide', { side: side.toUpperCase() }) }}
          </SButton>
        </div>
        <p v-if="!comparison(row).eligible" class="voice-review__hint" role="status">
          {{ t('voiceListening.sameTextRequired') }}
        </p>
        <SButton size="lg" variant="ghost" :disabled="pool(row).length < 2 || !active" :aria-expanded="advancedVisible" @click="openAdvanced(row)">
          {{ t('voiceListening.advancedTitle') }}
        </SButton>
      </section>
      <div v-for="take in row.takes" :key="take.id" class="voice-review__take" :class="{ 'voice-review__take--selected': take.selected }">
        <div class="voice-review__take-header">
          <strong>{{ take.selected ? t('audioWorkspace.selected') : t('audioWorkspace.history') }}</strong><span v-if="take.stale || take.unavailable" class="voice-review__warning">{{ t(take.unavailable ? 'audioWorkspace.unavailable' : 'audioWorkspace.stale') }}</span>
        </div>
        <p class="voice-review__text">
          {{ take.spokenText }}
        </p>
        <div class="voice-review__actions">
          <SButton size="lg" variant="secondary" :disabled="busy || reviewing || !active || take.unavailable" @click="preview(row, take.id)">
            {{ t('audioWorkspace.preview') }}
          </SButton>
          <SButton v-if="!take.selected" size="lg" :disabled="busy || reviewing || !active || take.unavailable" @click="requestSelection(row, take)">
            {{ row.selectedTake ? t('audioWorkspace.replaceSelected') : t('audioWorkspace.bind') }}
          </SButton>
          <SButton v-else-if="take.stale" size="lg" variant="outline" :disabled="busy || reviewing || !active || take.unavailable || !verifyRetained" @click="requestSelection(row, take)">
            {{ t('voiceListening.reviewRetain') }}
          </SButton>
          <SButton v-if="take.selected" size="lg" variant="outline" :disabled="busy || reviewing || !active" @click="emit('select', row.lineId, row.locale, null, true)">
            {{ t('audioWorkspace.clearSelected') }}
          </SButton>
        </div>
        <p v-if="acknowledged[`${rowKey(row)}/${take.id}`]" class="voice-review__hint" role="status">
          {{ t('voiceListening.retainedAcknowledged') }}
        </p>
        <details class="voice-review__provenance">
          <summary>{{ t('audioWorkspace.provenance') }}</summary><p>{{ take.providerId }} · {{ take.model }} · {{ take.voiceId }}</p><p>{{ t(`audioWorkspace.source.${take.source}`) }} · {{ new Date(take.createdAt).toLocaleString() }}</p><p v-if="take.rights">
            {{ take.rights.license }} · {{ take.rights.subject }} · {{ take.rights.consentRecord }}
          </p><code>{{ row.lineId }}</code><code>{{ take.id }}</code><code>{{ take.assetId }}</code><code>SHA-256: {{ take.sha256 }}</code><code>{{ take.inputFingerprint }}</code>
        </details>
      </div>
    </article>
    <section v-if="pending" class="voice-review__confirmation" aria-labelledby="take-confirm-title">
      <h3 id="take-confirm-title">
        {{ t('voiceListening.adoptTitle') }}
      </h3>
      <p>{{ pending.candidate.spokenText }}</p><p>{{ t(pending.candidate.stale ? 'voiceListening.staleConfirm' : pending.row.selectedTake ? 'voiceListening.replaceConfirm' : 'voiceListening.adoptConfirm') }}</p>
      <label><input :checked="pending.confirmed" type="checkbox" @change="pending = { ...pending, confirmed: ($event.target as HTMLInputElement).checked }"><span>{{ t('voiceListening.confirmChecked') }}</span></label>
      <div class="voice-review__actions">
        <SButton size="lg" :loading="confirming" :disabled="!pending.confirmed || busy || reviewing || confirming || !active" @click="confirmSelection">
          {{ t('voiceListening.confirmAdopt') }}
        </SButton><SButton size="lg" variant="outline" @click="pending = undefined">
          {{ t('voiceListening.cancel') }}
        </SButton>
      </div>
    </section>
    <div v-if="advancedOpened" v-show="advancedVisible">
      <SButton size="lg" variant="ghost" @click="advancedVisible = false">
        {{ t('voiceListening.foldAdvanced') }}
      </SButton>
      <AudioAdvancedListening ref="advanced" :active="active && advancedVisible" :candidates="advancedCandidates" :project-candidates="projectCandidates" :project-id="projectId" :scope-key="scopeKey" :context-revision="JSON.stringify({ revision: snapshot.revision, context })" :active-asset-id="activeAssetId" :styles-by-speaker="stylesBySpeaker" @stop="emit('stop')" @preview="(value, label) => emit('preview', value.assetId, value.sha256, value.spokenText, label)" />
    </div>
    <SButton v-if="advancedOpened && !advancedVisible" size="lg" variant="ghost" @click="advancedVisible = true">
      {{ t('voiceListening.reopenAdvanced') }}
    </SButton>
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
  color: var(--adv-text-primary);
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

.voice-review__compare,
.voice-review__confirmation {
  display: grid;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  min-width: 0;
}
.voice-review__compare-side {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--adv-space-sm);
}
.voice-review__compare-side :deep(.s-select-trigger) {
  min-width: 0;
}
.voice-review__compare-side :deep(.s-select-trigger > span:first-child) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.voice-review__confirmation h3,
.voice-review__confirmation p {
  margin: 0;
  overflow-wrap: anywhere;
}
.voice-review__confirmation label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  min-height: 48px;
}
.voice-review__confirmation input {
  width: 20px;
  height: 20px;
  accent-color: var(--adv-primary);
}
@media (max-width: 359px) {
  .voice-review__compare-side {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
