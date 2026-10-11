<script setup lang="ts">
import type { DesignedVoiceProfile, VoiceDesignPreview, VoiceDesignSample } from '@advjs/types'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ voice: DesignedVoiceProfile, previews: VoiceDesignPreview[], busy: boolean }>()
const emit = defineEmits<{ audition: [id: string], cancel: [id: string], register: [id: string], sample: [sample: VoiceDesignSample], select: [input: { voiceId: string, locale: string, providerId: string, assetId: string, replaceSelected: boolean }], apply: [input: { voiceId: string, locale: string, providerId: string, replaceBinding: boolean }] }>()
const { t } = useI18n()
const replaceSelected = shallowRef(false)
const replaceBinding = shallowRef(false)
const candidates = computed(() => props.previews.filter(preview => preview.voiceId === props.voice.id))
const selected = (sample: VoiceDesignSample) => props.voice.design.selectedSamples[sample.locale]?.[sample.providerId]?.assetId === sample.assetId
</script>

<template>
  <section class="voice-design-candidates" data-testid="voice-design-candidates">
    <h3>{{ t('voiceDesigner.candidates') }}</h3>
    <article v-for="candidate in candidates" :key="candidate.id" class="voice-design-candidate" :data-preview-id="candidate.id">
      <strong>{{ candidate.locale }} · {{ candidate.providerId }} · {{ t(`voiceDesigner.statuses.${candidate.status}`) }}</strong>
      <p v-if="candidate.error" class="voice-design-error">
        {{ candidate.error }}
      </p><p v-if="candidate.status === 'unknown'">
        {{ t('voiceDesigner.unknownHint') }}
      </p>
      <template v-if="candidate.candidate">
        <blockquote>{{ candidate.candidate.text }}</blockquote><p>{{ candidate.candidate.model }} · {{ candidate.candidate.providerVoiceId }} · {{ candidate.candidate.durationSeconds }} s · {{ candidate.candidate.bytes }} B</p><code>{{ candidate.candidate.sha256 }}</code>
      </template>
      <div class="voice-design-actions">
        <SButton v-if="['ready', 'registered'].includes(candidate.status)" size="lg" variant="outline" :disabled="busy" @click="emit('audition', candidate.id)">
          {{ t('voiceDesigner.audition') }}
        </SButton><SButton v-if="candidate.status === 'ready'" size="lg" :disabled="busy" @click="emit('register', candidate.id)">
          {{ t('voiceDesigner.register') }}
        </SButton><SButton v-if="candidate.status === 'registered'" size="lg" variant="outline" :disabled="busy" @click="emit('register', candidate.id)">
          {{ t('voiceDesigner.restore') }}
        </SButton><SButton v-if="['queued', 'running'].includes(candidate.status)" size="lg" variant="danger" :disabled="busy" @click="emit('cancel', candidate.id)">
          {{ t('voiceDesigner.cancelPreview') }}
        </SButton>
      </div>
    </article>
    <h3>{{ t('voiceDesigner.samples') }}</h3><p>{{ t('voiceDesigner.profileHint') }}</p>
    <label class="voice-design-checkbox"><input v-model="replaceSelected" type="checkbox" :disabled="busy">{{ t('voiceDesigner.replaceSelected') }}</label><label class="voice-design-checkbox"><input v-model="replaceBinding" type="checkbox" :disabled="busy">{{ t('voiceDesigner.replaceBinding') }}</label>
    <article v-for="sample in voice.design.samples" :key="sample.assetId" class="voice-design-candidate" :data-sample-id="sample.assetId">
      <strong>{{ sample.locale }} · {{ sample.providerId }} <span v-if="selected(sample)">· {{ t('voiceDesigner.selected') }}</span></strong><blockquote>{{ sample.text }}</blockquote><code>{{ sample.assetId }} · {{ sample.sha256 }}</code><div class="voice-design-actions">
        <SButton size="lg" variant="outline" :disabled="busy" @click="emit('sample', sample)">
          {{ t('voiceDesigner.audition') }}
        </SButton><SButton size="lg" variant="outline" :disabled="busy || selected(sample)" @click="emit('select', { voiceId: voice.id, locale: sample.locale, providerId: sample.providerId, assetId: sample.assetId, replaceSelected })">
          {{ t('voiceDesigner.select') }}
        </SButton><SButton size="lg" :disabled="busy || !selected(sample)" @click="emit('apply', { voiceId: voice.id, locale: sample.locale, providerId: sample.providerId, replaceBinding })">
          {{ t('voiceDesigner.apply') }}
        </SButton>
      </div>
    </article>
  </section>
</template>
