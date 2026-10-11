<script setup lang="ts">
import type { DesignedVoiceProfile } from '@advjs/types'
import { computed, onBeforeUnmount, shallowRef, toRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVoiceDesigner } from '../../composables/useVoiceDesigner'
import SButton from '../ui/SButton.vue'
import VoiceDesignCandidates from './VoiceDesignCandidates.vue'
import VoiceDesignForm from './VoiceDesignForm.vue'
import VoiceDesignPreviewRequest from './VoiceDesignPreviewRequest.vue'
import './voice-design.css'

const props = defineProps<{ active: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const { session, snapshot, review, busy, error, available, previewUrl, previewId, stopAudio, reload, refresh, save, plan, execute, cancel, audition, auditionSample, register, select, apply } = useVoiceDesigner(toRef(props, 'active'), () => emit('changed'))
const speakerId = shallowRef('narrator')
const voiceId = shallowRef('')
const voices = computed(() => snapshot.value?.library.voices.filter((voice): voice is DesignedVoiceProfile => voice.characterId === speakerId.value && Boolean(voice.design)) ?? [])
const voice = computed(() => voices.value.find(voice => voice.id === voiceId.value))
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
        <label>{{ t('voiceDesigner.speaker') }}<select v-model="speakerId" :disabled="busy"><option v-for="speaker in snapshot.speakers" :key="speaker.id" :value="speaker.id">{{ speaker.name }} · {{ speaker.id }}</option></select></label><label>{{ t('voiceDesigner.voice') }}<select v-model="voiceId" :disabled="busy"><option v-if="!voices.length" value="">{{ t('voiceDesigner.noVoice') }}</option><option v-for="option in voices" :key="option.id" :value="option.id">{{ option.label }} · {{ option.version }} · {{ option.id }}</option></select></label>
      </div>
      <section v-if="previewUrl" class="voice-design-audition">
        <strong>{{ t('voiceDesigner.sha') }}</strong><code>{{ previewId }}</code><audio ref="player" :src="previewUrl" controls preload="metadata" @error="error = 'VOICE_DESIGN_AUDIO_UNAVAILABLE'" /><SButton size="lg" variant="outline" @click="stop">
          {{ t('voiceDesigner.stop') }}
        </SButton>
      </section>
      <template v-if="voice">
        <VoiceDesignPreviewRequest :key="voice.id" :voice="voice" :busy="busy" :review="review" @plan="plan" @execute="execute" @revise="review = undefined" /><VoiceDesignCandidates :voice="voice" :previews="snapshot.previews" :busy="busy" @audition="audition" @cancel="cancel" @register="register" @sample="auditionSample" @select="select" @apply="apply" />
      </template>
      <details class="voice-design-create" :open="!voice">
        <summary>{{ t(voice ? 'voiceDesigner.newVersion' : 'voiceDesigner.newVoice') }}</summary><VoiceDesignForm :key="`${speakerId}:${voiceId}`" :snapshot="snapshot" :speaker-id="speakerId" :prior="voice" :busy="busy" @save="save" />
      </details>
    </template>
  </div>
</template>
