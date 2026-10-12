<script setup lang="ts">
import type { DesignedVoiceProfile, VoiceDesignDraft } from '@advjs/types'
import { computed, onBeforeUnmount, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVoiceDesigner } from '../../composables/useVoiceDesigner'
import SButton from '../ui/SButton.vue'
import VoiceDesignCandidates from './VoiceDesignCandidates.vue'
import VoiceDesignForm from './VoiceDesignForm.vue'
import VoiceDesignPreviewRequest from './VoiceDesignPreviewRequest.vue'
import './voice-design.css'

const props = defineProps<{ active: boolean, initialSpeakerId?: string }>()
const emit = defineEmits<{ changed: [], generate: [speakerId: string] }>()
const { t } = useI18n()
const { session, snapshot, review, busy, error, available, previewUrl, previewId, stopAudio, reload, refresh, save, plan, execute, cancel, audition, auditionSample, register, select, apply } = useVoiceDesigner(toRef(props, 'active'), () => emit('changed'))
const speakerId = shallowRef(props.initialSpeakerId || 'narrator')
const draftDirty = shallowRef(false)
const pendingSpeaker = shallowRef('')
const formNonce = shallowRef(0)
const form = useTemplateRef<{ acceptSavedDraft: () => void }>('form')
function switchSpeaker(value: string) {
  if (value === speakerId.value) {
    pendingSpeaker.value = ''
    return
  }
  if (busy.value || draftDirty.value) {
    pendingSpeaker.value = value
    return
  }
  speakerId.value = value
  pendingSpeaker.value = ''
}
watch(() => props.initialSpeakerId, value => switchSpeaker(value || 'narrator'))
watch([busy, draftDirty], () => {
  if (!busy.value && !draftDirty.value && pendingSpeaker.value)
    switchSpeaker(pendingSpeaker.value)
})
function discardAndSwitch() {
  if (busy.value)
    return
  draftDirty.value = false
  formNonce.value++
  if (pendingSpeaker.value)
    switchSpeaker(pendingSpeaker.value)
}
async function saveDraft(draft: VoiceDesignDraft) {
  await save(draft)
  if (!error.value && snapshot.value?.library.voices.some(voice => voice.id === draft.id && voice.version === draft.version))
    form.value?.acceptSavedDraft()
}
const voiceId = shallowRef('')
const voices = computed(() => snapshot.value?.library.voices.filter((voice): voice is DesignedVoiceProfile => voice.characterId === speakerId.value && Boolean(voice.design)) ?? [])
const voice = computed(() => voices.value.find(voice => voice.id === voiceId.value))
const legacyVoices = computed(() => snapshot.value?.library.voices.filter(voice => voice.characterId === speakerId.value && !voice.design) ?? [])
const applied = computed(() => {
  const profile = snapshot.value?.speakers.find(speaker => speaker.id === speakerId.value)?.profile
  return Boolean(voice.value && Object.values(profile?.locales ?? {}).some(locale => Object.values(locale.providers).some(binding => binding.projectVoiceId === voice.value!.id && binding.projectVoiceVersion === voice.value!.version)))
})
watch(voices, (values) => {
  if (!values.some(voice => voice.id === voiceId.value))
    voiceId.value = values.at(-1)?.id ?? ''
})
const player = useTemplateRef<HTMLAudioElement>('player')
watch([previewUrl, speakerId, voiceId, () => props.active], () => player.value?.pause(), { flush: 'sync' })
watch([speakerId, voiceId], () => {
  stopAudio()
  review.value = undefined
})
onBeforeUnmount(() => player.value?.pause())
function stop() {
  player.value?.pause()
  stopAudio()
}
</script>

<template>
  <div class="voice-design-workspace" data-testid="voice-design-workspace" :aria-busy="busy">
    <header><h2>{{ t('voiceDesigner.title') }}</h2><p>{{ t('voiceDesigner.intro') }}</p></header>
    <div class="voice-design-actions">
      <SButton size="lg" variant="outline" :disabled="busy || !session.client.value" @click="reload">
        {{ t('voiceDesigner.reload') }}
      </SButton><SButton size="lg" variant="ghost" :disabled="busy || !session.client.value" @click="refresh">
        {{ t('voiceDesigner.restore') }}
      </SButton>
    </div>
    <p v-if="!available" role="status">
      {{ snapshot?.unavailableCode ?? t('voiceDesigner.unavailable') }}
    </p><p v-if="error" class="voice-design-error" role="alert">
      {{ error }}
    </p>
    <template v-if="snapshot && available">
      <div class="voice-design-fields">
        <label>{{ t('voiceDesigner.speaker') }}<select :value="speakerId" :disabled="busy" @change="switchSpeaker(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = speakerId"><option v-for="speaker in snapshot.speakers" :key="speaker.id" :value="speaker.id">{{ speaker.name }} · {{ speaker.id }}</option></select></label><label>{{ t('voiceDesigner.voice') }}<select v-model="voiceId" :disabled="busy"><option v-if="!voices.length" value="">{{ t('voiceDesigner.noVoice') }}</option><option v-for="option in voices" :key="option.id" :value="option.id">{{ option.label }} · {{ option.version }} · {{ option.id }}</option></select></label>
      </div>
      <section v-if="pendingSpeaker" class="voice-design-candidate" role="status">
        <p>{{ t('voiceWorkflow.pendingSpeaker', { speaker: pendingSpeaker }) }}</p>
        <SButton size="lg" variant="outline" :disabled="busy" @click="discardAndSwitch">
          {{ t('voiceWorkflow.discardAndSwitch') }}
        </SButton>
      </section>
      <section v-if="legacyVoices.length" class="voice-design-candidate">
        <p>{{ t('voiceWorkflow.legacyLibrary') }}</p>
        <ul>
          <li v-for="legacy in legacyVoices" :key="legacy.id">
            {{ legacy.label || legacy.id }} · {{ legacy.version }}
          </li>
        </ul>
      </section>
      <section v-if="applied" class="voice-design-candidate" role="status">
        <p>{{ t('voiceWorkflow.appliedVersion', { speaker: speakerId, voice: voice?.label, version: voice?.version }) }}</p>
        <SButton size="lg" :disabled="busy || !active" @click="emit('generate', speakerId)">
          {{ t('voiceWorkflow.generateCharacter') }}
        </SButton>
      </section>
      <section v-if="previewUrl" class="voice-design-audition">
        <strong>{{ t('voiceDesigner.sha') }}</strong><code>{{ previewId }}</code><audio ref="player" :src="previewUrl" controls preload="metadata" @error="error = 'VOICE_DESIGN_AUDIO_UNAVAILABLE'" /><SButton size="lg" variant="outline" @click="stop">
          {{ t('voiceDesigner.stop') }}
        </SButton>
      </section>
      <template v-if="voice">
        <VoiceDesignPreviewRequest :key="voice.id" :voice="voice" :busy="busy" :review="review" @plan="plan" @execute="execute" @revise="review = undefined" /><VoiceDesignCandidates :voice="voice" :previews="snapshot.previews" :busy="busy" @audition="audition" @cancel="cancel" @register="register" @sample="auditionSample" @select="select" @apply="apply" />
      </template>
      <details class="voice-design-create" :open="!voice">
        <summary>{{ t(voice ? 'voiceDesigner.newVersion' : 'voiceDesigner.newVoice') }}</summary><VoiceDesignForm ref="form" :key="`${speakerId}:${voiceId}:${formNonce}`" :snapshot="snapshot" :speaker-id="speakerId" :prior="voice" :busy="busy" @save="saveDraft" @dirty="draftDirty = $event" />
      </details>
    </template>
  </div>
</template>
