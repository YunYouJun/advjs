<script setup lang="ts">
import type { CreativeMediaProjectState } from '../../utils/creativeMediaRecovery'
import type { CreativeVoiceImportEntry } from '../../utils/creativeVoiceImportCache'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { voiceWorkflowLocation } from '../../utils/voiceWorkflow'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ entry: CreativeVoiceImportEntry, actual?: CreativeMediaProjectState, disabled: boolean, stale: boolean, managedAvailable?: boolean, selectedTake?: boolean }>()
defineEmits<{ register: [], select: [], reconcile: [], restore: [], abandon: [], discard: [] }>()
const { t } = useI18n()
const selectionApproved = shallowRef(false)
watch([() => props.entry.id, () => props.selectedTake], () => selectionApproved.value = false)
</script>

<template>
  <article class="voice-import__review" data-testid="creative-voice-candidate">
    <h3>{{ entry.review.target.request.speakerId }} · {{ t(`creativeTeam.mediaRecovery.voiceState.${entry.state}`) }}</h3>
    <p>{{ entry.review.target.request.text }}</p>
    <p v-if="entry.state === 'reviewed' && entry.phase !== 'selected'">
      {{ t('creativeTeam.voiceImport.unselected') }}
    </p>
    <p v-if="entry.phase === 'selected'">
      {{ t('creativeTeam.mediaMilestone.selectionHint') }}
    </p>
    <p v-if="actual === 'partial'" role="status">
      {{ t('creativeTeam.mediaRecovery.partial') }}
    </p>
    <p v-if="actual === 'conflict' && ['registering', 'restoring'].includes(entry.state)" role="status">
      {{ t('creativeTeam.mediaRecovery.conflict') }}
    </p>
    <p v-if="stale && ['reviewed', 'registering'].includes(entry.state)" role="status">
      {{ t('creativeTeam.mediaRecovery.stale') }}
    </p>
    <p>{{ entry.review.duration.toFixed(3) }} s · {{ entry.review.sampleRate }} Hz · {{ entry.review.bytes }} B</p><code>{{ entry.review.sha256 }}</code>
    <p>{{ entry.review.attribution }}</p>
    <details v-for="change in entry.review.changes" :key="change.path">
      <summary>{{ change.path }}</summary><pre>{{ change.expected ?? '∅' }}</pre><pre>{{ change.content ?? '∅' }}</pre>
    </details>
    <div class="voice-import__actions">
      <SButton v-if="entry.state === 'reviewed'" size="lg" :disabled="disabled || stale || actual !== 'before'" @click="$emit('register')">
        {{ t(managedAvailable ? 'creativeTeam.mediaMilestone.submit' : 'creativeTeam.voiceImport.commit') }}
      </SButton>
      <SButton v-if="entry.state === 'submitting'" size="lg" :disabled="disabled" @click="$emit('register')">
        {{ t('creativeTeam.mediaMilestone.retry') }}
      </SButton>
      <template v-if="!entry.managed">
        <SButton v-if="entry.state === 'registering' && ['before', 'partial'].includes(actual ?? '')" size="lg" :disabled="disabled || stale" @click="$emit('register')">
          {{ t('creativeTeam.mediaRecovery.resumeVoice') }}
        </SButton>
        <SButton v-if="['registering', 'restoring', 'registered'].includes(entry.state)" size="lg" variant="outline" :disabled="disabled" @click="$emit('reconcile')">
          {{ t('creativeTeam.mediaRecovery.check') }}
        </SButton>
        <SButton v-if="['registering', 'restoring'].includes(entry.state) && ['before', 'partial', 'after'].includes(actual ?? '')" size="lg" variant="outline" :disabled="disabled" @click="$emit('restore')">
          {{ t('creativeTeam.mediaRecovery.restoreVoice') }}
        </SButton>
        <SButton v-if="['registering', 'restoring'].includes(entry.state) && ['before', 'conflict'].includes(actual ?? '')" size="lg" variant="ghost" :disabled="disabled" @click="$emit('abandon')">
          {{ t('creativeTeam.mediaRecovery.abandon') }}
        </SButton>
        <SButton v-if="['reviewed', 'restored', 'abandoned'].includes(entry.state)" size="lg" variant="ghost" :disabled="disabled" @click="$emit('discard')">
          {{ t('creativeTeam.mediaRecovery.discardVoice') }}
        </SButton>
      </template>
    </div>
    <p v-if="entry.managed?.artifact" role="status">
      {{ t('creativeTeam.mediaMilestone.review') }} · <code>{{ entry.managed.artifact.artifactId }}</code>
    </p>
    <p v-if="selectedTake || entry.state === 'selected'" role="status">
      {{ t('creativeTeam.mediaMilestone.selected') }}
    </p>
    <template v-if="managedAvailable && entry.managed && entry.state === 'registered' && entry.phase !== 'selected' && !selectedTake">
      <label class="voice-import__selection"><input v-model="selectionApproved" type="checkbox" :disabled="disabled"><span>{{ t('creativeTeam.mediaMilestone.selectionApproval') }}</span></label>
      <SButton size="lg" variant="outline" :disabled="disabled || !selectionApproved" @click="$emit('select')">
        {{ t('creativeTeam.mediaMilestone.prepareSelection') }}
      </SButton>
    </template>
    <p v-if="entry.state === 'registered' && !selectedTake" role="status">
      {{ t('creativeTeam.voiceImport.imported') }}
    </p>
    <RouterLink :to="voiceWorkflowLocation('review', entry.review.target.request.speakerId, entry.review.target.lineId)">
      {{ t('creativeTeam.voiceImport.review') }}
    </RouterLink>
  </article>
</template>

<style scoped>
.voice-import__review {
  min-width: 0;
  margin-block: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  overflow-wrap: anywhere;
}
.voice-import__review h3 {
  font-size: var(--adv-font-title);
}
.voice-import__review pre {
  overflow: auto;
  max-height: 280px;
  padding: var(--adv-space-sm);
  background: var(--adv-surface-elevated);
  white-space: pre-wrap;
}
.voice-import__selection {
  display: flex;
  align-items: flex-start;
  gap: var(--adv-space-sm);
  min-height: 44px;
  padding-block: var(--adv-space-sm);
  box-sizing: border-box;
}
.voice-import__selection input {
  flex: none;
  width: 20px;
  height: 20px;
}
.voice-import__selection input:focus-visible {
  outline: 3px solid var(--adv-primary-subtle);
  outline-offset: 2px;
}
.voice-import__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
  margin-block: var(--adv-space-md);
}
.voice-import__review a {
  color: var(--adv-primary);
}
</style>
