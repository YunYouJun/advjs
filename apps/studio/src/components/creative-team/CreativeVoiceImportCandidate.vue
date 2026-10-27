<script setup lang="ts">
import type { CreativeMediaProjectState } from '../../utils/creativeMediaRecovery'
import type { CreativeVoiceImportEntry } from '../../utils/creativeVoiceImportCache'
import { useI18n } from 'vue-i18n'
import { voiceWorkflowLocation } from '../../utils/voiceWorkflow'
import SButton from '../ui/SButton.vue'

defineProps<{ entry: CreativeVoiceImportEntry, actual?: CreativeMediaProjectState, disabled: boolean, stale: boolean }>()
defineEmits<{ register: [], reconcile: [], restore: [], abandon: [], discard: [] }>()
const { t } = useI18n()
</script>

<template>
  <article class="voice-import__review" data-testid="creative-voice-candidate">
    <h3>{{ entry.review.target.request.speakerId }} · {{ t(`creativeTeam.mediaRecovery.voiceState.${entry.state}`) }}</h3>
    <p>{{ entry.review.target.request.text }}</p>
    <p v-if="entry.state === 'reviewed'">
      {{ t('creativeTeam.voiceImport.unselected') }}
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
        {{ t('creativeTeam.voiceImport.commit') }}
      </SButton>
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
    </div>
    <p v-if="entry.state === 'registered'" role="status">
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
