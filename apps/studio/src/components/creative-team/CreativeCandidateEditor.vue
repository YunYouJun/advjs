<script setup lang="ts">
import type { CreativeEditableOutput } from '@advjs/agent'
import { computed, onMounted, ref, shallowRef, toRaw, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = withDefaults(defineProps<{ output: CreativeEditableOutput, candidateId: string, busy: boolean, disabled?: boolean, knownCharacterIds?: readonly string[] }>(), { disabled: false, knownCharacterIds: () => [] })
const emit = defineEmits<{ save: [value: { output: CreativeEditableOutput, reason: string }], close: [] }>()
const { t } = useI18n()
const draft = ref<CreativeEditableOutput>(structuredClone(toRaw(props.output)))
const reason = shallowRef('')
const summaryInput = useTemplateRef<HTMLInputElement>('summaryInput')
onMounted(() => summaryInput.value?.focus())
const originalIds = new Set(props.output.kind === 'characters' ? props.output.characters.map(item => item.id) : props.output.chapters.map(item => item.id))
const knownIds = computed(() => [...new Set([...props.knownCharacterIds, ...(draft.value.kind === 'characters' ? draft.value.characters.map(item => item.id) : [])])])
function lines(value: string) {
  return value.split('\n').map(line => line.trim()).filter(Boolean)
}
function save() {
  if (!props.busy && !props.disabled && reason.value.trim())
    emit('save', { output: structuredClone(toRaw(draft.value)), reason: reason.value.trim() })
}
</script>

<template>
  <form class="candidate-editor" data-testid="creative-candidate-editor" @submit.prevent="save">
    <h4>{{ t('creativeTeam.editCandidate') }}</h4>
    <p class="candidate-editor__hint">
      {{ t('creativeTeam.editHint') }}
    </p>
    <p v-if="disabled" class="candidate-editor__notice" role="status">
      {{ t('creativeTeam.editStale') }}
    </p>
    <label :for="`${candidateId}-summary`">{{ t('creativeTeam.editSummary') }}</label>
    <input :id="`${candidateId}-summary`" ref="summaryInput" v-model="draft.summary" class="candidate-editor__input" maxlength="1000" required :disabled="busy">
    <template v-if="draft.kind === 'characters'">
      <fieldset v-for="character in draft.characters" :key="character.id" class="candidate-editor__fieldset">
        <legend>{{ character.name }} · {{ character.id }}</legend>
        <label :for="`${candidateId}-${character.id}-name`">{{ t('creativeTeam.editName') }}</label>
        <input :id="`${candidateId}-${character.id}-name`" v-model="character.name" class="candidate-editor__input" maxlength="80" required :disabled="busy">
        <label :for="`${candidateId}-${character.id}-description`">{{ t('creativeTeam.editDescription') }}</label>
        <textarea :id="`${candidateId}-${character.id}-description`" v-model="character.description" class="candidate-editor__input" rows="3" maxlength="4000" required :disabled="busy" />
        <label :for="`${candidateId}-${character.id}-motivation`">{{ t('creativeTeam.motivation') }}</label>
        <textarea :id="`${candidateId}-${character.id}-motivation`" v-model="character.motivation" class="candidate-editor__input" rows="2" maxlength="4000" required :disabled="busy" />
        <label :for="`${candidateId}-${character.id}-speaking`">{{ t('creativeTeam.speaking') }}</label>
        <textarea :id="`${candidateId}-${character.id}-speaking`" v-model="character.speakingStyle" class="candidate-editor__input" rows="2" maxlength="4000" required :disabled="busy" />
        <label :for="`${candidateId}-${character.id}-visual`">{{ t('creativeTeam.visual') }} · {{ t('creativeTeam.onePerLine') }}</label>
        <textarea :id="`${candidateId}-${character.id}-visual`" class="candidate-editor__input" rows="2" :value="character.visualConstraints.join('\n')" :disabled="busy" @input="character.visualConstraints = lines(($event.target as HTMLTextAreaElement).value)" />
        <label :for="`${candidateId}-${character.id}-voice`">{{ t('creativeTeam.voice') }} · {{ t('creativeTeam.onePerLine') }}</label>
        <textarea :id="`${candidateId}-${character.id}-voice`" class="candidate-editor__input" rows="2" :value="character.voiceConstraints.join('\n')" :disabled="busy" @input="character.voiceConstraints = lines(($event.target as HTMLTextAreaElement).value)" />
        <fieldset v-for="(relation, index) in character.relationships" :key="index" class="candidate-editor__fieldset">
          <legend>{{ t('creativeTeam.relationships') }} {{ index + 1 }}</legend>
          <label :for="`${candidateId}-${character.id}-target-${index}`">{{ t('creativeTeam.relationTarget') }}</label>
          <input :id="`${candidateId}-${character.id}-target-${index}`" v-model="relation.targetId" :list="`${candidateId}-known-characters`" class="candidate-editor__input" maxlength="64" required :disabled="busy">
          <label :for="`${candidateId}-${character.id}-relation-${index}`">{{ t('creativeTeam.relationType') }}</label>
          <input :id="`${candidateId}-${character.id}-relation-${index}`" v-model="relation.type" class="candidate-editor__input" maxlength="80" required :disabled="busy">
          <label :for="`${candidateId}-${character.id}-relation-description-${index}`">{{ t('creativeTeam.editDescription') }}</label>
          <textarea :id="`${candidateId}-${character.id}-relation-description-${index}`" v-model="relation.description" class="candidate-editor__input" maxlength="4000" required :disabled="busy" />
          <SButton variant="ghost" size="lg" :disabled="busy" @click="character.relationships = character.relationships.filter((_, itemIndex) => itemIndex !== index)">
            {{ t('creativeTeam.removeRelation') }}
          </SButton>
        </fieldset>
        <SButton variant="outline" size="lg" :disabled="busy || character.relationships.length >= 16" @click="character.relationships = [...character.relationships, { targetId: '', type: '', description: '' }]">
          {{ t('creativeTeam.addRelation') }}
        </SButton>
      </fieldset>
      <datalist :id="`${candidateId}-known-characters`">
        <option v-for="id in knownIds" :key="id" :value="id" />
      </datalist>
    </template>
    <template v-else>
      <fieldset v-for="chapter in draft.chapters" :key="chapter.id" class="candidate-editor__fieldset">
        <legend>{{ chapter.id }}</legend>
        <label :for="`${candidateId}-${chapter.id}-title`">{{ t('creativeTeam.chapterTitle') }}</label>
        <input :id="`${candidateId}-${chapter.id}-title`" v-model="chapter.title" class="candidate-editor__input" maxlength="160" required :disabled="busy">
        <label :for="`${candidateId}-${chapter.id}-content`">AdvScript</label>
        <textarea :id="`${candidateId}-${chapter.id}-content`" v-model="chapter.content" class="candidate-editor__input candidate-editor__script" rows="12" maxlength="32000" required :disabled="busy" />
      </fieldset>
      <label :for="`${candidateId}-entry`">{{ t('creativeTeam.entryChapter') }}</label>
      <input :id="`${candidateId}-entry`" v-model="draft.entryChapterId" class="candidate-editor__input" maxlength="64" required :disabled="busy" :list="`${candidateId}-chapters`">
      <datalist :id="`${candidateId}-chapters`">
        <option v-for="id in originalIds" :key="id" :value="id" />
      </datalist>
      <label :for="`${candidateId}-endings`">{{ t('creativeTeam.endingAddresses') }} · {{ t('creativeTeam.onePerLine') }}</label>
      <textarea :id="`${candidateId}-endings`" class="candidate-editor__input" rows="2" :value="draft.endingAddresses.join('\n')" required :disabled="busy" @input="draft.endingAddresses = lines(($event.target as HTMLTextAreaElement).value)" />
    </template>
    <label :for="`${candidateId}-reason`">{{ t('creativeTeam.editReason') }}</label>
    <textarea :id="`${candidateId}-reason`" v-model="reason" class="candidate-editor__input" rows="2" maxlength="4000" required :disabled="busy" />
    <div class="candidate-editor__actions">
      <SButton type="submit" size="lg" :loading="busy" :disabled="disabled || !reason.trim()">
        {{ t('creativeTeam.saveCandidate') }}
      </SButton>
      <SButton size="lg" variant="ghost" :disabled="busy" @click="emit('close')">
        {{ t('creativeTeam.closeEditor') }}
      </SButton>
    </div>
  </form>
</template>

<style scoped>
.candidate-editor {
  display: grid;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-page);
}
.candidate-editor__hint,
.candidate-editor__notice {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  line-height: 1.6;
}
.candidate-editor__notice {
  border-inline-start: 3px solid var(--adv-accent);
  padding-inline-start: var(--adv-space-sm);
}
.candidate-editor__fieldset {
  display: grid;
  gap: var(--adv-space-sm);
  min-width: 0;
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
}
.candidate-editor__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-card);
  font: inherit;
  resize: vertical;
}
.candidate-editor__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.candidate-editor__script {
  font-family: var(--adv-font-mono);
  font-size: var(--adv-font-body-sm);
}
.candidate-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
}
@media (max-width: 420px) {
  .candidate-editor,
  .candidate-editor__fieldset {
    padding: var(--adv-space-sm);
  }
}
</style>
