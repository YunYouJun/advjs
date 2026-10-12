<script setup lang="ts">
import type { VoiceListeningCandidate } from '@advjs/audio'
import type { StudioVoicePlayback } from '../../composables/useStudioVoiceListening'
import { voiceListeningAnonymousSamples } from '@advjs/audio'
import { computed, onScopeDispose, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudioVoiceListening } from '../../composables/useStudioVoiceListening'
import SButton from '../ui/SButton.vue'
import SSelect from '../ui/SSelect.vue'
import AudioListeningEnvironment from './AudioListeningEnvironment.vue'
import AudioListeningRatings from './AudioListeningRatings.vue'

const props = defineProps<{ active: boolean, candidates: VoiceListeningCandidate[], projectCandidates: VoiceListeningCandidate[], projectId: string, scopeKey: string, contextRevision: string, activeAssetId?: string, stylesBySpeaker?: Record<string, string> }>()
const emit = defineEmits<{ preview: [candidate: VoiceListeningCandidate, label: string], stop: [] }>()
const { t } = useI18n()
const candidateScope = shallowRef('current')
const pool = computed(() => candidateScope.value === 'current' ? props.candidates : props.projectCandidates)
const chosen = shallowRef(props.candidates.slice(0, 2).map(candidate => candidate.takeId))
const draft = useStudioVoiceListening({ candidates: () => props.projectCandidates, projectId: () => props.projectId, scopeKey: () => props.scopeKey, contextRevision: () => props.contextRevision, active: () => props.active, stop: () => emit('stop') })
const restored = shallowRef(false)
const anonymous = computed(() => draft.session.value ? voiceListeningAnonymousSamples(draft.session.value) : [])
watch(candidateScope, () => {
  emit('stop')
  chosen.value = pool.value.slice(0, 2).map(candidate => candidate.takeId)
})
let restoreEpoch = 0
watch([() => props.active, () => props.scopeKey, () => props.projectId], () => restoreEpoch++, { flush: 'sync' })
onScopeDispose(() => restoreEpoch++)
function choose(id: string, value: boolean) {
  chosen.value = value ? [...chosen.value, id] : chosen.value.filter(takeId => takeId !== id)
}
function save() {
  const json = draft.exportJson()
  if (!json)
    return
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `voice-listening-${draft.session.value!.id}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
async function restore(event: Event) {
  const epoch = ++restoreEpoch
  emit('stop')
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || file.size > 2 * 1024 * 1024) {
    draft.error.value = 'VOICE_LISTENING_RESTORE_INVALID'
    return
  }
  try {
    const scope = props.scopeKey
    const json = await file.text()
    if (json.length > 512 * 1024)
      throw new Error('VOICE_LISTENING_RESTORE_INVALID')
    if (epoch !== restoreEpoch || scope !== props.scopeKey || !props.active)
      return
    draft.restore(JSON.parse(json))
    restored.value = !draft.error.value
  }
  catch {
    if (epoch === restoreEpoch)
      draft.error.value = 'VOICE_LISTENING_RESTORE_INVALID'
  }
  input.value = ''
}
function observe(event: StudioVoicePlayback) {
  draft.playback(event)
}
function invalidate() {
  if (draft.session.value)
    draft.restore(draft.session.value)
}
defineExpose({ observe, invalidate })
</script>

<template>
  <section class="advanced-listening" data-testid="studio-advanced-listening" aria-labelledby="advanced-listening-title">
    <h3 id="advanced-listening-title">
      {{ t('voiceListening.advancedTitle') }}
    </h3>
    <p class="advanced-listening__hint">
      {{ t('voiceListening.advancedHint') }}
    </p>
    <p class="advanced-listening__hint">
      {{ t('voiceListening.noReference') }}
    </p>
    <p v-if="draft.session.value?.samples.some(sample => sample.candidate.stale) || candidates.some(candidate => candidate.stale)" class="advanced-listening__hint">
      {{ t('voiceListening.historicalStyle') }}
    </p>
    <p v-if="draft.error.value" role="alert">
      {{ t('voiceListening.operationFailed') }} ({{ draft.error.value }})
    </p>
    <fieldset v-if="!draft.session.value" class="advanced-listening__setup">
      <legend>{{ t('voiceListening.chooseCandidates') }}</legend>
      <SSelect v-model="candidateScope" size="lg" :aria-label="t('voiceListening.candidateScope')" :options="['current', 'project'].map(value => ({ value, label: t(`voiceListening.scope.${value}`) }))" />
      <label v-for="candidate in pool" :key="candidate.takeId"><input type="checkbox" :checked="chosen.includes(candidate.takeId)" :disabled="!chosen.includes(candidate.takeId) && chosen.length >= 32" @change="choose(candidate.takeId, ($event.target as HTMLInputElement).checked)"><span>{{ candidate.takeId }}<br>{{ candidate.spokenText }}</span></label>
      <SButton size="lg" :disabled="chosen.length < 2 || chosen.length > 32" @click="draft.start(chosen)">
        {{ t('voiceListening.startAnonymous') }}
      </SButton>
    </fieldset>
    <template v-else>
      <p role="status" class="advanced-listening__hint">
        {{ t(draft.summary.value?.eligibleHumanReview ? 'voiceListening.complete' : 'voiceListening.pending') }}
      </p>
      <p v-if="restored" class="advanced-listening__hint">
        {{ t('voiceListening.restored') }}
      </p>
      <AudioListeningEnvironment :value="draft.session.value.environment" :human-confirmed="draft.session.value.humanConfirmed" :can-attest="Boolean(draft.summary.value?.canAttest)" @update="draft.environment" @attest="draft.attest" />
      <AudioListeningRatings :samples="draft.session.value.samples" :anonymous="anonymous" :disabled="draft.invalidated.value" :styles-by-speaker="stylesBySpeaker" :active-asset-id="activeAssetId" @review="draft.review" @preview="(candidate, label) => emit('preview', candidate, label)" />
      <SButton size="lg" variant="outline" @click="save">
        {{ t('voiceListening.export') }}
      </SButton>
    </template>
    <label class="advanced-listening__restore"><span>{{ t('voiceListening.restore') }}</span><input type="file" accept="application/json" @change="restore"></label>
  </section>
</template>

<style scoped>
.advanced-listening {
  display: grid;
  gap: var(--adv-space-md);
  min-width: 0;
  border-top: 1px solid var(--adv-border-subtle);
  padding-top: var(--adv-space-md);
}
.advanced-listening h3,
.advanced-listening p {
  margin: 0;
  overflow-wrap: anywhere;
}
.advanced-listening__hint {
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  line-height: 1.5;
}
.advanced-listening__setup {
  display: grid;
  gap: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  padding: var(--adv-space-md);
  min-width: 0;
}
.advanced-listening__setup label {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  min-height: 48px;
  overflow-wrap: anywhere;
}
.advanced-listening__setup input {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--adv-primary);
}
.advanced-listening__restore {
  display: grid;
  gap: var(--adv-space-sm);
  min-height: 48px;
}
.advanced-listening__restore input {
  min-width: 0;
  max-width: 100%;
  min-height: 48px;
  color: var(--adv-text-primary);
}
</style>
