<script setup lang="ts">
import type { StudioVoicePlayback } from '../../composables/useStudioVoiceListening'
import type { VoiceWorkflowSection } from '../../utils/voiceWorkflow'
import { createVoiceListeningPlaybackObserver } from '@advjs/audio'
import { computed, inject, nextTick, onBeforeUnmount, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAudioWorkspace } from '../../composables/useAudioWorkspace'
import { useManagedVoiceSession } from '../../composables/useManagedVoiceSession'
import { studioVoiceGenerationTransportKey } from '../../utils/voiceGeneration'
import SButton from '../ui/SButton.vue'
import AudioLibrary from './AudioLibrary.vue'
import AudioLocalConnection from './AudioLocalConnection.vue'
import AudioMixerPanel from './AudioMixerPanel.vue'
import AudioPublication from './AudioPublication.vue'
import AudioVoiceJobs from './AudioVoiceJobs.vue'
import AudioVoiceReview from './AudioVoiceReview.vue'
import VoiceDesignWorkspace from './VoiceDesignWorkspace.vue'

const props = defineProps<{ active: boolean, initialSection?: VoiceWorkflowSection, speakerId?: string, lineId?: string }>()
const emit = defineEmits<{ play: [] }>()
const { t } = useI18n()
const tab = shallowRef(props.initialSection ?? 'library')
const workflowSpeaker = shallowRef(props.speakerId ?? '')
const workflowLine = shallowRef(props.lineId ?? '')
watch([() => props.initialSection, () => props.speakerId, () => props.lineId], () => {
  tab.value = props.initialSection ?? 'library'
  workflowSpeaker.value = props.speakerId ?? ''
  workflowLine.value = props.lineId ?? ''
})
function continueToJobs(speakerId: string) {
  workflowSpeaker.value = speakerId
  workflowLine.value = ''
  tab.value = 'jobs'
}
function continueToReview(scope: { speakerId: string, lineId: string }) {
  workflowSpeaker.value = scope.speakerId
  workflowLine.value = scope.lineId
  tab.value = 'review'
}
const transport = inject(studioVoiceGenerationTransportKey, undefined)
const session = useManagedVoiceSession()
const transportReady = computed(() => session.configured.value ? Boolean(session.client.value) : Boolean(transport?.prepare))
const player = useTemplateRef<HTMLAudioElement>('player')
const voiceReview = useTemplateRef<{ observe: (event: StudioVoicePlayback) => void, invalidate: () => void }>('voiceReview')
const previewText = shallowRef('')
const previewLabel = shallowRef('')
watch(() => props.active, active => !active && player.value?.pause(), { flush: 'sync' })
onBeforeUnmount(() => player.value?.pause())
const { snapshot, reviewContext, nativeProjectId, scopeKey, mixer, revision, loading, busy, error, missingCatalog, previewUrl, previewAssetId, reload, preview, stopPreview, importAsset, updateAsset, removeAsset, select, verifyRetained, saveMixer, initialize } = useAudioWorkspace(toRef(props, 'active'))
const observer = createVoiceListeningPlaybackObserver({
  media: () => player.value,
  source: () => previewUrl.value,
  onPlayback: event => voiceReview.value?.observe({ assetId: previewAssetId.value, ...event }),
  onInvalid: (code) => {
    error.value = code
    voiceReview.value?.invalidate()
    stopPreview()
  },
})
watch(previewUrl, () => {
  observer.reset()
  player.value?.pause()
  player.value?.removeAttribute('src')
  player.value?.load()
  if (!previewUrl.value) {
    previewText.value = ''
    previewLabel.value = ''
  }
}, { flush: 'sync' })
watch(tab, stopPreview, { flush: 'sync' })
watch(scopeKey, () => observer.reset(), { flush: 'sync' })
async function previewVoice(assetId: string, sha256: string, text: string, label?: string) {
  await preview(assetId, sha256)
  if (!props.active || previewAssetId.value !== assetId || !previewUrl.value) {
    if (error.value)
      voiceReview.value?.invalidate()
    return
  }
  previewText.value = text
  previewLabel.value = label ?? ''
  await nextTick()
  const url = previewUrl.value
  try {
    await player.value?.play()
  }
  catch {
    if (props.active && url === previewUrl.value)
      error.value = t('voiceListening.playRejected')
  }
}
function observePlayback(event: Event) {
  observer.observe(event)
}
</script>

<template>
  <div class="audio-workspace" data-testid="audio-workspace" :aria-busy="loading || busy">
    <div class="audio-workspace__intro">
      <div>
        <h1>{{ t('audioWorkspace.title') }}</h1>
        <p>{{ t('audioWorkspace.intro') }}</p>
      </div>
      <SButton size="lg" variant="outline" :disabled="busy || loading" @click="reload">
        {{ t('audioWorkspace.reload') }}
      </SButton>
    </div>
    <AudioLocalConnection />
    <div v-if="error && !(missingCatalog && error === 'ADV_AUDIO_CATALOG_REQUIRED')" class="audio-workspace__error" role="alert">
      <strong>{{ t(error.includes('VOICE_CONFLICT') ? 'audioWorkspace.conflict' : 'audioWorkspace.operationFailed') }}</strong>
      <p>{{ error }}</p>
    </div>
    <p v-if="loading" class="audio-workspace__hint" role="status">
      {{ t('audioWorkspace.loading') }}
    </p>
    <section v-if="missingCatalog" class="audio-workspace__panel audio-workspace__empty">
      <h2>{{ t('audioWorkspace.initializeTitle') }}</h2>
      <p>{{ t('audioWorkspace.initializeHint') }}</p>
      <SButton size="lg" :loading="busy" :disabled="loading" @click="initialize">
        {{ t('audioWorkspace.initialize') }}
      </SButton>
    </section>
    <template v-if="snapshot">
      <nav class="audio-workspace__tabs" :aria-label="t('audioWorkspace.sections')">
        <button v-for="section in ['library', 'review', 'mixer', 'jobs', 'design']" :key="section" type="button" :aria-current="tab === section ? 'page' : undefined" @click="tab = section">
          {{ t(`audioWorkspace.${section}`) }}
        </button>
      </nav>
      <section v-if="workflowSpeaker || workflowLine" class="audio-workspace__panel audio-workspace__transport" data-testid="voice-workflow-scope">
        <p>{{ t('voiceWorkflow.currentScope', { speaker: workflowSpeaker || t('voiceWorkflow.allSpeakers') }) }} <code v-if="workflowLine">{{ workflowLine }}</code></p>
        <SButton size="lg" variant="ghost" @click="workflowSpeaker = ''; workflowLine = ''">
          {{ t('voiceWorkflow.clearScope') }}
        </SButton>
      </section>
      <section v-if="previewUrl" class="audio-workspace__panel audio-workspace__preview" :aria-label="t('audioWorkspace.preview')">
        <div class="audio-workspace__preview-heading">
          <strong>{{ t('audioWorkspace.preview') }}</strong>
          <SButton size="lg" variant="ghost" @click="stopPreview">
            {{ t('audioWorkspace.stopPreview') }}
          </SButton>
        </div>
        <code>{{ previewLabel || previewAssetId }}</code>
        <p v-if="previewText">
          {{ previewText }}
        </p>
        <audio ref="player" :src="previewUrl" controls preload="metadata" @loadedmetadata="observePlayback" @play="observePlayback" @playing="observePlayback" @waiting="observePlayback" @timeupdate="observePlayback" @pause="observePlayback" @seeking="observePlayback" @seeked="observePlayback" @ratechange="observePlayback" @ended="observePlayback" @error="error = t('audioWorkspace.previewFailed')" />
      </section>
      <section class="audio-workspace__panel audio-workspace__transport">
        <div>
          <strong>{{ t('audioWorkspace.generate') }}</strong>
          <p>{{ t(session.configured.value ? transportReady ? 'audioService.connected' : 'audioService.loginRequired' : transportReady ? 'audioWorkspace.transportReady' : 'audioWorkspace.transportUnavailable') }}</p>
        </div>
        <SButton size="lg" :disabled="!transportReady" :title="t(transportReady ? 'audioWorkspace.transportReady' : 'audioWorkspace.transportUnavailable')" @click="tab = 'jobs'">
          {{ t('audioWorkspace.generate') }}
        </SButton>
      </section>
      <AudioPublication :active="active" />
      <div v-show="tab === 'library'" class="audio-workspace__panel">
        <AudioLibrary :key="revision" :snapshot="snapshot" :busy="busy || loading" @preview="preview" @import="importAsset" @update="updateAsset" @remove="removeAsset" />
      </div>
      <div v-show="tab === 'review'" class="audio-workspace__panel">
        <AudioVoiceReview ref="voiceReview" :snapshot="snapshot" :context="reviewContext" :busy="busy || loading" :active="active && tab === 'review'" :project-id="nativeProjectId" :scope-key="scopeKey" :active-asset-id="previewAssetId" :speaker-id="workflowSpeaker" :line-id="workflowLine" :verify-retained="verifyRetained" @preview="previewVoice" @stop="stopPreview" @select="select" />
        <SButton size="lg" variant="outline" @click="emit('play')">
          {{ t('voiceWorkflow.playSelected') }}
        </SButton>
        <p class="audio-workspace__hint">
          {{ t('voiceWorkflow.playHint') }}
        </p>
      </div>
      <div v-show="tab === 'mixer'" class="audio-workspace__panel">
        <AudioMixerPanel :mixer="mixer" :revision="revision" :busy="busy || loading" @save="saveMixer" />
      </div>
      <div v-if="tab === 'jobs'" class="audio-workspace__panel">
        <AudioVoiceJobs :active="active" :speaker-id="workflowSpeaker" :line-id="workflowLine" @changed="reload" @review="continueToReview" />
      </div>
      <div v-if="tab === 'design'" class="audio-workspace__panel">
        <VoiceDesignWorkspace :active="active" :initial-speaker-id="workflowSpeaker" @changed="reload" @generate="continueToJobs" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.audio-workspace {
  max-width: 1040px;
  margin: 0 auto;
  padding: var(--adv-space-md);
  display: grid;
  gap: var(--adv-space-md);
  color: var(--adv-text-primary);
}
.audio-workspace__intro {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  justify-content: space-between;
  flex-wrap: wrap;
}
.audio-workspace__intro h1 {
  margin: 0 0 8px;
  font-size: var(--adv-font-title);
}
.audio-workspace__intro p,
.audio-workspace__transport p,
.audio-workspace__hint {
  margin: 0;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body-sm);
  line-height: 1.5;
}
.audio-workspace__intro > div {
  flex: 1;
  min-width: 180px;
}
.audio-workspace__panel {
  min-width: 0;
  padding: var(--adv-space-md);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
}
.audio-workspace__tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  padding: 4px;
  gap: 4px;
  background: var(--adv-surface-elevated);
  border-radius: var(--adv-radius-md);
}
.audio-workspace__tabs button {
  min-height: 48px;
  border: 0;
  border-radius: var(--adv-radius-sm);
  background: transparent;
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-body);
  font-weight: 600;
  cursor: pointer;
}
.audio-workspace__tabs button[aria-current] {
  background: var(--adv-surface-card);
  color: var(--adv-primary);
  box-shadow: var(--adv-shadow-subtle);
}
.audio-workspace__tabs button:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
  outline-offset: 2px;
}
.audio-workspace__transport {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}
.audio-workspace__transport > div {
  flex: 1;
  min-width: 160px;
}
.audio-workspace__transport p {
  margin-top: 8px;
}
.audio-workspace__preview {
  display: grid;
  gap: 12px;
}
.audio-workspace__preview-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.audio-workspace__preview code {
  overflow-wrap: anywhere;
  font-size: var(--adv-font-caption);
}
.audio-workspace__preview audio {
  width: 100%;
  min-width: 0;
}
.audio-workspace__error {
  border: 1px solid var(--adv-danger);
  border-radius: var(--adv-radius-md);
  padding: 16px;
  overflow-wrap: anywhere;
}
.audio-workspace__error p {
  margin: 8px 0 0;
  font-size: var(--adv-font-body-sm);
}
.audio-workspace__empty h2 {
  margin-top: 0;
  font-size: var(--adv-font-title);
}
.audio-workspace__empty p {
  color: var(--adv-text-secondary);
  line-height: 1.5;
}
@media (min-width: 768px) {
  .audio-workspace {
    padding: var(--adv-space-lg);
  }
}
</style>
