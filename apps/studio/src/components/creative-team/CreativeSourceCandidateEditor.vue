<script setup lang="ts">
import type { CreativeTextEditOutput } from '@advjs/agent'
import { parseCreativeTextEditOutput } from '@advjs/agent'
import { prepareMarkdownVoiceIdentities } from '@advjs/core'
import { computed, onMounted, ref, shallowRef, toRaw, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'

const props = defineProps<{ output: CreativeTextEditOutput, path: string, candidateId: string, busy: boolean, disabled: boolean }>()
const emit = defineEmits<{ save: [value: { output: CreativeTextEditOutput, reason: string }], close: [] }>()
const { t } = useI18n()
const draft = ref(structuredClone(toRaw(props.output)))
const reason = shallowRef('')
const error = shallowRef(false)
const preparing = shallowRef(false)
const working = computed(() => props.busy || preparing.value)
const chapter = computed(() => /^adv\/chapters\/[\w.-]+\.adv\.md$/.test(props.path))
const identities = shallowRef<{ content: string, added: number, retained: number }>()
const prepared = computed(() => identities.value?.content === draft.value.content ? identities.value : undefined)
const summaryInput = useTemplateRef<HTMLInputElement>('summaryInput')
const crlf = props.output.content.includes('\r\n')
onMounted(() => summaryInput.value?.focus())
function changeContent(value: string) {
  draft.value.content = crlf ? value.replace(/\r?\n/g, '\r\n') : value
}
function save() {
  if (working.value || props.disabled || !reason.value.trim())
    return
  error.value = false
  try {
    emit('save', { output: parseCreativeTextEditOutput(toRaw(draft.value)), reason: reason.value.trim() })
  }
  catch {
    error.value = true
  }
}
async function prepareIdentities() {
  if (working.value || props.disabled || !chapter.value)
    return
  const before = draft.value.content
  preparing.value = true
  error.value = false
  try {
    const result = await prepareMarkdownVoiceIdentities({ [props.path]: before })
    if (props.disabled || props.busy || draft.value.content !== before)
      throw new Error('CREATIVE_IDENTITY_DRAFT_CHANGED')
    draft.value = parseCreativeTextEditOutput({ ...toRaw(draft.value), content: result.files[props.path]! })
    identities.value = { content: draft.value.content, added: result.assigned.length, retained: result.retained }
  }
  catch {
    error.value = true
  }
  finally {
    preparing.value = false
  }
}
</script>

<template>
  <form class="source-editor" data-testid="creative-source-candidate-editor" @submit.prevent="save">
    <h4>{{ t('creativeTeam.sourceText.title') }}</h4>
    <p>{{ t('creativeTeam.sourceText.hint') }}</p>
    <p v-if="disabled" role="status">
      {{ t('creativeTeam.editStale') }}
    </p>
    <p class="source-editor__path">
      {{ t('creativeTeam.sourceText.path') }} · {{ path }}
    </p>
    <label :for="`${candidateId}-source-summary`">{{ t('creativeTeam.editSummary') }}</label>
    <input :id="`${candidateId}-source-summary`" ref="summaryInput" v-model="draft.summary" class="source-editor__input" maxlength="1000" required :disabled="working">
    <label :for="`${candidateId}-source-content`">{{ t('creativeTeam.sourceText.content') }}</label>
    <textarea :id="`${candidateId}-source-content`" class="source-editor__input source-editor__content" rows="14" :value="draft.content" :disabled="working" @input="changeContent(($event.target as HTMLTextAreaElement).value)" />
    <template v-if="chapter">
      <p>{{ t('creativeTeam.identityHint', { dialogueSyntax: '@人物ID' }) }}</p>
      <SButton variant="outline" size="lg" :disabled="working || disabled" :loading="preparing" @click="prepareIdentities">
        {{ t('creativeTeam.prepareIdentities') }}
      </SButton>
      <p v-if="prepared" role="status">
        {{ t('creativeTeam.identitiesPrepared', prepared) }}
      </p>
    </template>
    <p v-if="error" role="alert">
      {{ t('creativeTeam.sourceText.error') }}
    </p>
    <label :for="`${candidateId}-source-reason`">{{ t('creativeTeam.editReason') }}</label>
    <textarea :id="`${candidateId}-source-reason`" v-model="reason" class="source-editor__input" rows="2" maxlength="4000" required :disabled="working" />
    <div class="source-editor__actions">
      <SButton type="submit" size="lg" :disabled="working || disabled || !reason.trim()" :loading="busy">
        {{ t('creativeTeam.saveCandidate') }}
      </SButton>
      <SButton variant="ghost" size="lg" :disabled="working" @click="emit('close')">
        {{ t('creativeTeam.closeEditor') }}
      </SButton>
    </div>
  </form>
</template>

<style scoped>
.source-editor {
  display: grid;
  gap: var(--adv-space-sm);
  margin-block: var(--adv-space-md);
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  line-height: 1.6;
  min-width: 0;
}
.source-editor__path {
  overflow-wrap: anywhere;
  font-size: var(--adv-font-body-sm);
}
.source-editor__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: var(--adv-space-sm);
  color: var(--adv-text-primary);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  font: inherit;
}
.source-editor__content {
  font-family: var(--adv-font-mono);
  font-size: var(--adv-font-body-sm);
  line-height: 1.6;
}
.source-editor__input:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
.source-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--adv-space-sm);
}
</style>
