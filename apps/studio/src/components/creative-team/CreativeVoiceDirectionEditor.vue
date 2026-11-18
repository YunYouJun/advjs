<script setup lang="ts">
import type { CreativeEditableOutput } from '@advjs/agent'
import { onMounted, ref, shallowRef, toRaw, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import CreativeVoiceIntentEditor from './CreativeVoiceIntentEditor.vue'

type VoiceDirection = Extract<CreativeEditableOutput, { kind: 'voice-direction' }>
const props = defineProps<{ output: VoiceDirection, candidateId: string, busy: boolean, disabled: boolean }>()
const emit = defineEmits<{ save: [value: { output: VoiceDirection, reason: string }], close: [] }>()
const { t } = useI18n()
const draft = ref<VoiceDirection>(structuredClone(toRaw(props.output)))
const language = shallowRef(props.output.locale ?? '')
const reason = shallowRef('')
const summaryInput = useTemplateRef<HTMLInputElement>('summaryInput')
onMounted(() => summaryInput.value?.focus())
function save() {
  if (!props.busy && !props.disabled && language.value.trim() && reason.value.trim())
    emit('save', { output: { ...structuredClone(toRaw(draft.value)), locale: language.value.trim() }, reason: reason.value.trim() })
}
</script>

<template>
  <form class="voice-plan-editor" data-testid="creative-voice-plan-editor" @submit.prevent="save">
    <h4>{{ t('creativeTeam.voicePlan.title') }}</h4>
    <p>{{ t('creativeTeam.voicePlan.hint') }}</p>
    <p v-if="disabled" role="status">
      {{ t('creativeTeam.editStale') }}
    </p>
    <label :for="`${candidateId}-voice-summary`">{{ t('creativeTeam.editSummary') }}</label>
    <input :id="`${candidateId}-voice-summary`" ref="summaryInput" v-model="draft.summary" class="voice-plan-editor__input" maxlength="1000" required :disabled="busy">
    <label :for="`${candidateId}-voice-language`">{{ t('creativeTeam.voicePlan.locale') }}</label>
    <input :id="`${candidateId}-voice-language`" v-model="language" class="voice-plan-editor__input" placeholder="zh-CN" maxlength="40" required :disabled="busy">
    <template v-for="cast in draft.cast" :key="cast.speakerId">
      <p>{{ cast.designBrief }} · {{ cast.performance }}</p>
      <CreativeVoiceIntentEditor :id="`${candidateId}-${cast.speakerId}`" v-model="cast.intent" :speaker-id="cast.speakerId" :performance="cast.performance" :busy="busy" />
    </template>
    <h5>{{ t('creativeTeam.dictionary') }}</h5>
    <p>{{ t('creativeTeam.voicePlan.dictionaryHint') }}</p>
    <fieldset v-for="(entry, index) in draft.dictionary" :key="index" class="voice-plan-editor__word">
      <legend>{{ t('creativeTeam.dictionary') }} {{ index + 1 }}</legend>
      <label :for="`${candidateId}-term-${index}`">{{ t('creativeTeam.voicePlan.term') }}</label><input :id="`${candidateId}-term-${index}`" v-model="entry.term" class="voice-plan-editor__input" maxlength="120" required :disabled="busy">
      <label :for="`${candidateId}-pronunciation-${index}`">{{ t('creativeTeam.voicePlan.pronunciation') }}</label><input :id="`${candidateId}-pronunciation-${index}`" v-model="entry.pronunciation" class="voice-plan-editor__input" maxlength="240" required :disabled="busy">
      <SButton variant="ghost" size="lg" :disabled="busy" @click="draft.dictionary = draft.dictionary.filter((_, item) => item !== index)">
        {{ t('creativeTeam.voicePlan.removeWord') }}
      </SButton>
    </fieldset>
    <SButton variant="outline" size="lg" :disabled="busy || draft.dictionary.length >= 64" @click="draft.dictionary = [...draft.dictionary, { term: '', pronunciation: '' }]">
      {{ t('creativeTeam.voicePlan.addWord') }}
    </SButton>
    <label :for="`${candidateId}-voice-reason`">{{ t('creativeTeam.editReason') }}</label><textarea :id="`${candidateId}-voice-reason`" v-model="reason" class="voice-plan-editor__input" rows="2" maxlength="4000" required :disabled="busy" />
    <div class="voice-plan-editor__actions">
      <SButton type="submit" size="lg" :loading="busy" :disabled="disabled || !language.trim() || !reason.trim()">
        {{ t('creativeTeam.saveCandidate') }}
      </SButton>
      <SButton variant="ghost" size="lg" :disabled="busy" @click="emit('close')">
        {{ t('creativeTeam.closeEditor') }}
      </SButton>
    </div>
  </form>
</template>

<style scoped>
.voice-plan-editor {
  display: grid;
  min-width: 0;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
  margin-top: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-page);
  overflow-wrap: anywhere;
}
.voice-plan-editor__word {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
}
.voice-plan-editor__input {
  width: 100%;
  box-sizing: border-box;
  min-height: 44px;
  padding: var(--adv-space-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  font: inherit;
  resize: vertical;
}
.voice-plan-editor__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.voice-plan-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
}
</style>
