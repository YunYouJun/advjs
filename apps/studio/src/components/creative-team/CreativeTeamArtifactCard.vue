<script setup lang="ts">
import type { CreativeArtifact, CreativeCandidateEditRequest, CreativeTeamDecisionInput, CreativeTextEditOutput } from '@advjs/agent'
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SButton from '../ui/SButton.vue'
import CreativeCandidateEditor from './CreativeCandidateEditor.vue'
import CreativeSourceCandidateEditor from './CreativeSourceCandidateEditor.vue'
import CreativeTeamMedia from './CreativeTeamMedia.vue'
import CreativeTeamOutput from './CreativeTeamOutput.vue'
import CreativeVoiceDirectionEditor from './CreativeVoiceDirectionEditor.vue'

const props = defineProps<{ artifact: CreativeArtifact, busy: boolean, canSelect: boolean, canRework: boolean, canEdit: boolean, sourceOutput?: CreativeTextEditOutput, editSaved?: boolean, knownCharacterIds?: readonly string[] }>()
const emit = defineEmits<{ decide: [decision: CreativeTeamDecisionInput], edit: [request: CreativeCandidateEditRequest] }>()
const { t } = useI18n()
const reason = shallowRef('')
const editing = shallowRef(false)
const editorOpened = shallowRef(false)
const artifactRoot = useTemplateRef<HTMLElement>('artifactRoot')
const editableOutput = computed(() => props.artifact.output?.kind === 'characters' || props.artifact.output?.kind === 'chapter' || props.artifact.output?.kind === 'voice-direction' ? props.artifact.output : undefined)
watch(() => props.editSaved, (saved) => {
  if (saved) {
    editing.value = false
    editorOpened.value = false
  }
})
async function openEditor() {
  editorOpened.value = true
  editing.value = true
  await nextTick()
  artifactRoot.value?.querySelector<HTMLInputElement>('[data-testid="creative-candidate-editor"] input, [data-testid="creative-voice-plan-editor"] input, [data-testid="creative-source-candidate-editor"] input')?.focus()
}
async function closeEditor() {
  editing.value = false
  await nextTick()
  const target = artifactRoot.value?.querySelector<HTMLElement>('[data-edit-candidate]') ?? artifactRoot.value?.querySelector<HTMLElement>('h3')
  target?.focus()
}
function select() {
  emit('decide', props.artifact.output?.kind === 'production-plan'
    ? { type: 'accept-production-plan', artifactId: props.artifact.id }
    : { type: 'select', taskId: props.artifact.taskId, artifactIds: [props.artifact.id], reason: t('creativeTeam.selectionHint') })
}
</script>

<template>
  <article ref="artifactRoot" class="team-artifact" :aria-label="artifact.summary" :data-creative-artifact="artifact.id">
    <header class="team-artifact__header">
      <strong>{{ t(`creativeTeam.roles.${artifact.partner}`) }}</strong>
      <span class="team-artifact__status">{{ t(`creativeTeam.candidateStatus.${artifact.status}`) }}</span>
    </header>
    <h3 class="team-artifact__title" tabindex="-1">
      {{ artifact.summary }}
    </h3>
    <p v-if="artifact.editedFrom" class="team-artifact__hint">
      {{ t(artifact.status === 'adopted' ? 'creativeTeam.authorRevisionAdopted' : 'creativeTeam.authorRevision') }}
    </p>
    <p class="team-artifact__source" :title="artifact.source.revision">
      {{ t('creativeTeam.source') }} · {{ artifact.source.revision.slice(0, 12) }}
    </p>
    <details class="team-artifact__details">
      <summary>{{ t('creativeTeam.details') }}</summary>
      <CreativeTeamOutput v-if="artifact.output" :output="artifact.output" />
      <CreativeTeamMedia v-else-if="artifact.media" :media="artifact.media" />
      <pre v-else-if="artifact.legacyResult" class="team-artifact__text">{{ artifact.legacyResult.streamText }}</pre>
    </details>
    <details v-if="artifact.changes.length" class="team-artifact__details">
      <summary>{{ t('creativeTeam.changes') }} · {{ artifact.changes.length }}</summary>
      <section v-for="change in artifact.changes" :key="change.path">
        <h4 class="team-artifact__path">
          {{ t(`creativeTeam.${change.before === null ? 'create' : change.after === null ? 'remove' : 'modify'}`) }} · {{ change.path }}
        </h4>
        <pre class="team-artifact__text">{{ change.after ?? change.before }}</pre>
      </section>
    </details>
    <p v-else class="team-artifact__hint">
      {{ t('creativeTeam.noChanges') }}
    </p>
    <SButton v-if="(canEdit || editorOpened) && !editing" data-edit-candidate variant="outline" size="lg" :disabled="busy" @click="openEditor">
      {{ t(canEdit ? 'creativeTeam.editCandidate' : 'creativeTeam.viewEditDraft') }}
    </SButton>
    <CreativeSourceCandidateEditor v-if="editorOpened && sourceOutput" v-show="editing" :output="sourceOutput" :path="artifact.changes[0]!.path" :candidate-id="artifact.id" :busy="busy" :disabled="!canEdit" @save="emit('edit', { artifactId: artifact.id, fingerprint: artifact.fingerprint, ...$event })" @close="closeEditor" />
    <template v-if="editorOpened && editableOutput">
      <CreativeVoiceDirectionEditor v-if="editableOutput.kind === 'voice-direction'" v-show="editing" :output="editableOutput" :candidate-id="artifact.id" :busy="busy" :disabled="!canEdit" @save="emit('edit', { artifactId: artifact.id, fingerprint: artifact.fingerprint, ...$event })" @close="closeEditor" />
      <CreativeCandidateEditor v-else v-show="editing" :output="editableOutput" :candidate-id="artifact.id" :busy="busy" :disabled="!canEdit" :known-character-ids="knownCharacterIds" @save="emit('edit', { artifactId: artifact.id, fingerprint: artifact.fingerprint, ...$event })" @close="closeEditor" />
    </template>
    <div v-if="canSelect" class="team-artifact__actions">
      <p class="team-artifact__hint">
        {{ t('creativeTeam.selectionHint') }}
      </p>
      <SButton size="lg" :loading="busy" @click="select">
        {{ t(artifact.output?.kind === 'production-plan' ? 'creativeTeam.acceptPlan' : 'creativeTeam.select') }}
      </SButton>
    </div>
    <form v-if="canRework" class="team-artifact__rework" @submit.prevent="emit('decide', { type: 'request-rework', taskId: artifact.taskId, reason: reason.trim() })">
      <label :for="`rework-${artifact.id}`">{{ t('creativeTeam.reworkReason') }}</label>
      <textarea :id="`rework-${artifact.id}`" v-model="reason" class="team-artifact__input" rows="2" maxlength="4000" required :disabled="busy" />
      <p class="team-artifact__hint">
        {{ t('creativeTeam.reworkHint') }}
      </p>
      <SButton size="lg" variant="outline" type="submit" :disabled="!reason.trim()" :loading="busy">
        {{ t('creativeTeam.rework') }}
      </SButton>
    </form>
  </article>
</template>

<style scoped>
.team-artifact {
  padding: var(--adv-space-md);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-md);
  background: var(--adv-surface-card);
  overflow-wrap: anywhere;
  min-width: 0;
}
.team-artifact__header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--adv-space-sm);
}
.team-artifact__status,
.team-artifact__source,
.team-artifact__hint {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}
.team-artifact__title {
  font-size: var(--adv-font-subtitle);
  line-height: 1.5;
}
.team-artifact__details {
  margin-block: var(--adv-space-sm);
}
.team-artifact__details > summary {
  cursor: pointer;
  min-height: 44px;
  display: flex;
  align-items: center;
  color: var(--adv-primary);
}
.team-artifact__path {
  font-size: var(--adv-font-body-sm);
}
.team-artifact__text {
  white-space: pre-wrap;
  max-height: 360px;
  overflow: auto;
  padding: var(--adv-space-sm);
  background: var(--adv-surface-page);
  font-size: var(--adv-font-body-sm);
}
.team-artifact__actions,
.team-artifact__rework {
  display: grid;
  gap: var(--adv-space-sm);
  margin-top: var(--adv-space-md);
}
.team-artifact__input {
  box-sizing: border-box;
  width: 100%;
  min-height: 64px;
  padding: var(--adv-space-sm);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-page);
  color: var(--adv-text-primary);
  font: inherit;
}
.team-artifact__input:focus-visible,
.team-artifact__details > summary:focus-visible {
  outline: 3px solid var(--adv-primary-soft);
}
</style>
