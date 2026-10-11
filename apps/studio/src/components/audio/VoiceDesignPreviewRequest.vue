<script setup lang="ts">
import type { DesignedVoiceProfile, VoiceDesignBudget, VoiceDesignPreviewReview } from '@advjs/types'
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ voice: DesignedVoiceProfile, busy: boolean, review?: VoiceDesignPreviewReview }>()
const emit = defineEmits<{ plan: [input: { voiceId: string, locale: string, providerId: string, text: string, budget: VoiceDesignBudget }], execute: [], revise: [] }>()
const { t } = useI18n()
const request = reactive({ locale: Object.keys(props.voice.design.locales)[0] ?? '', providerId: '', text: '', maxCharacters: 200, allowUnknownCost: false })
const providers = computed(() => Object.keys(props.voice.design.locales[request.locale]?.providers ?? {}))
watch(providers, (values) => {
  if (!values.includes(request.providerId))
    request.providerId = values[0] ?? ''
}, { immediate: true })
watch(request, () => emit('revise'))
</script>

<template>
  <section class="voice-design-preview-request" data-testid="voice-design-preview-request">
    <h3>{{ t('voiceDesigner.previewTitle') }}</h3><p>{{ t('voiceDesigner.previewHint') }}</p>
    <div class="voice-design-fields">
      <label>{{ t('voiceDesigner.locale') }}<select v-model="request.locale" :disabled="busy"><option v-for="locale in Object.keys(voice.design.locales)" :key="locale" :value="locale">{{ locale }}</option></select></label><label>{{ t('voiceDesigner.provider') }}<select v-model="request.providerId" :disabled="busy"><option v-for="provider in providers" :key="provider" :value="provider">{{ provider }}</option></select></label>
    </div>
    <label>{{ t('voiceDesigner.previewText') }}<textarea v-model="request.text" :disabled="busy" maxlength="4096" /></label>
    <label>{{ t('voiceDesigner.maxCharacters') }}<input v-model.number="request.maxCharacters" type="number" min="1" max="4096" :disabled="busy"></label>
    <label class="voice-design-checkbox"><input v-model="request.allowUnknownCost" type="checkbox" :disabled="busy">{{ t('voiceDesigner.approveUnknownCost') }}</label>
    <SButton size="lg" variant="outline" :disabled="busy || !request.text.trim() || !request.providerId || !request.allowUnknownCost" @click="emit('plan', { voiceId: voice.id, locale: request.locale, providerId: request.providerId, text: request.text, budget: { maxCharacters: request.maxCharacters, allowUnknownCost: request.allowUnknownCost } })">
      {{ t('voiceDesigner.planPreview') }}
    </SButton>
    <div v-if="review" class="voice-design-review">
      <h4>{{ t('voiceDesigner.reviewTitle') }}</h4><p>{{ review.locale }} · {{ review.providerId }} · {{ review.model }} · {{ review.providerVoiceId }} · {{ review.characterCount }} {{ t('voiceDesigner.characters') }}</p><blockquote>{{ review.text }}</blockquote><code>{{ review.presetSha256 }}</code><p>{{ t('voiceDesigner.unknownPrice') }}</p><SButton size="lg" :disabled="busy" @click="emit('execute')">
        {{ t('voiceDesigner.executePreview') }}
      </SButton>
    </div>
  </section>
</template>
