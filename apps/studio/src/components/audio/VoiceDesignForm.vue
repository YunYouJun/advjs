<script setup lang="ts">
import type { CharacterVoiceProfile, DesignedVoiceProfile, VoiceDesignDefinition, VoiceDesignDraft, VoiceDesignSnapshot, VoiceDesignSource } from '@advjs/types'
import { createAudioId, normalizeAudioLocale, parseVoiceDesignDraft } from '@advjs/audio'
import { computed, reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import VoiceProfileFields from './VoiceProfileFields.vue'

const props = defineProps<{ snapshot: VoiceDesignSnapshot, speakerId: string, prior?: DesignedVoiceProfile, busy: boolean }>()
const emit = defineEmits<{ save: [draft: VoiceDesignDraft] }>()
const { t } = useI18n()
const speaker = props.snapshot.speakers.find(speaker => speaker.id === props.speakerId)
const intent = shallowRef<CharacterVoiceProfile>({ intent: structuredClone(props.prior?.design.intent ?? speaker?.profile?.intent ?? {}) })
const identity = reactive({ id: `voice_${createAudioId('line').slice(5)}`, version: '1', label: props.prior?.label ?? speaker?.name ?? props.speakerId })
const locales = shallowRef<VoiceDesignDraft['locales']>(structuredClone(props.prior?.design.locales ?? {}))
const definition = reactive({ locale: 'zh-CN', providerId: '', preset: '', source: '' as VoiceDesignSource | '', providerVoiceId: '', description: '', referenceAssetId: '', referenceText: '', referenceMode: 'icl', license: '', subject: '', consentRecord: '' })
const error = shallowRef('')
const provider = computed(() => props.snapshot.providers.find(provider => provider.id === definition.providerId))
const preset = computed(() => provider.value?.presets.find(preset => preset.id === definition.preset))
const sources = computed(() => provider.value?.sources.filter(source => preset.value?.sources.includes(source)) ?? [])
const references = computed(() => props.snapshot.referenceAssets.filter(asset => !asset.characterId || asset.characterId === props.speakerId))
const rows = computed(() => Object.entries(locales.value).flatMap(([locale, value]) => Object.entries(value.providers).map(([providerId, definition]) => ({ locale, providerId, definition }))))
function putDefinition() {
  try {
    const locale = normalizeAudioLocale(definition.locale)
    if (!provider.value || !preset.value || !sources.value.includes(definition.source as VoiceDesignSource))
      throw new Error('VOICE_DESIGN_CAPABILITY_REQUIRED')
    let value: VoiceDesignDefinition
    if (definition.source === 'system') {
      if (!provider.value.builtInVoices.some(voice => voice.id === definition.providerVoiceId))
        throw new Error('VOICE_DESIGN_BUILTIN_REQUIRED')
      value = { preset: definition.preset, source: 'system', providerVoiceId: definition.providerVoiceId }
    }
    else if (definition.source === 'designed') {
      value = { preset: definition.preset, source: 'designed', description: definition.description.trim() }
    }
    else {
      const asset = references.value.find(asset => asset.id === definition.referenceAssetId)
      if (!asset)
        throw new Error('VOICE_DESIGN_REFERENCE_REQUIRED')
      value = { preset: definition.preset, source: 'cloned', reference: { assetId: asset.id, sha256: asset.sha256, mode: definition.referenceMode as 'icl' | 'embedding-only', ...(definition.referenceText.trim() ? { text: definition.referenceText.trim() } : {}) }, rights: { license: definition.license.trim(), subject: definition.subject.trim(), consentRecord: definition.consentRecord.trim() } }
    }
    const next = { ...locales.value, [locale]: { providers: { ...locales.value[locale]?.providers, [definition.providerId]: value } } }
    parseVoiceDesignDraft({ ...identity, characterId: props.speakerId, intent: intent.value.intent, locales: next })
    locales.value = next
    error.value = ''
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'VOICE_DESIGN_INVALID' }
}
function remove(locale: string, providerId: string) {
  const next = structuredClone(locales.value)
  delete next[locale]!.providers[providerId]
  if (!Object.keys(next[locale]!.providers).length)
    delete next[locale]
  locales.value = next
}
function save() {
  try {
    emit('save', parseVoiceDesignDraft({ ...identity, characterId: props.speakerId, intent: intent.value.intent, locales: locales.value, ...(props.prior ? { supersedes: { id: props.prior.id, version: props.prior.version } } : {}) }))
    error.value = ''
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'VOICE_DESIGN_INVALID' }
}
</script>

<template>
  <section class="voice-design-form" data-testid="voice-design-form">
    <h3>{{ t(prior ? 'voiceDesigner.newVersion' : 'voiceDesigner.newVoice') }}</h3><p>{{ t('voiceDesigner.immutableHint') }}</p>
    <div class="voice-design-fields">
      <label v-for="field in ['id', 'version', 'label'] as const" :key="field">{{ t(`voiceDesigner.${field}`) }}<input v-model="identity[field]" :disabled="busy"></label>
    </div>
    <VoiceProfileFields v-model="intent" :disabled="busy" intent-only />
    <h4>{{ t('voiceDesigner.definitions') }}</h4>
    <ul class="voice-design-rows">
      <li v-for="row in rows" :key="`${row.locale}:${row.providerId}`">
        <div><strong>{{ row.locale }} · {{ row.providerId }}</strong><p>{{ row.definition.preset }} · {{ t(`voiceDesigner.sources.${row.definition.source}`) }}</p></div><SButton size="lg" variant="ghost" :disabled="busy" @click="remove(row.locale, row.providerId)">
          {{ t('voiceDesigner.removeDefinition') }}
        </SButton>
      </li>
    </ul>
    <fieldset>
      <legend>{{ t('voiceDesigner.addDefinition') }}</legend>
      <div class="voice-design-fields">
        <label>{{ t('voiceDesigner.locale') }}<input v-model="definition.locale" :disabled="busy" placeholder="zh-CN"></label>
        <label>{{ t('voiceDesigner.provider') }}<select v-model="definition.providerId" :disabled="busy" @change="definition.preset = ''; definition.source = ''; definition.providerVoiceId = ''"><option value="">{{ t('voiceDesigner.chooseProvider') }}</option><option v-for="option in snapshot.providers" :key="option.id" :value="option.id">{{ option.id }} · {{ option.backend }}</option></select></label>
        <label>{{ t('voiceDesigner.preset') }}<select v-model="definition.preset" :disabled="busy || !provider" @change="definition.source = ''; definition.providerVoiceId = ''"><option value="">{{ t('voiceDesigner.choosePreset') }}</option><option v-for="option in provider?.presets ?? []" :key="option.id" :value="option.id">{{ option.id }} · {{ option.model }}</option></select></label>
        <label>{{ t('voiceDesigner.source') }}<select v-model="definition.source" :disabled="busy || !preset"><option value="">{{ t('voiceDesigner.chooseSource') }}</option><option v-for="source in sources" :key="source" :value="source">{{ t(`voiceDesigner.sources.${source}`) }}</option></select></label>
      </div>
      <label v-if="definition.source === 'system'">{{ t('voiceDesigner.builtin') }}<select v-model="definition.providerVoiceId" :disabled="busy"><option value="">{{ t('voiceDesigner.chooseBuiltin') }}</option><option v-for="voice in provider?.builtInVoices ?? []" :key="voice.id" :value="voice.id">{{ voice.label }}</option></select></label>
      <label v-if="definition.source === 'designed'">{{ t('voiceDesigner.description') }}<textarea v-model="definition.description" :disabled="busy" maxlength="4096" /></label>
      <template v-if="definition.source === 'cloned'">
        <p>{{ t('voiceDesigner.referenceHint') }}</p><label>{{ t('voiceDesigner.reference') }}<select v-model="definition.referenceAssetId" :disabled="busy"><option value="">{{ t('voiceDesigner.chooseReference') }}</option><option v-for="asset in references" :key="asset.id" :value="asset.id">{{ asset.title }} · {{ asset.sha256.slice(0, 12) }}</option></select></label>
        <div class="voice-design-fields">
          <label>{{ t('voiceDesigner.referenceMode') }}<select v-model="definition.referenceMode" :disabled="busy"><option value="icl">ICL</option><option value="embedding-only">Embedding only</option></select></label><label>{{ t('voiceDesigner.referenceText') }}<textarea v-model="definition.referenceText" :disabled="busy" /></label><label v-for="field in ['license', 'subject', 'consentRecord'] as const" :key="field">{{ t(`audioProfiles.${field}`) }}<input v-model="definition[field]" :disabled="busy"></label>
        </div>
      </template>
      <SButton size="lg" variant="outline" :disabled="busy || !definition.source" @click="putDefinition">
        {{ t('voiceDesigner.putDefinition') }}
      </SButton>
    </fieldset>
    <p v-if="error" class="voice-design-error" role="alert">
      {{ error }}
    </p>
    <SButton size="lg" :disabled="busy || !rows.length" @click="save">
      {{ t('voiceDesigner.saveVersion') }}
    </SButton>
  </section>
</template>
