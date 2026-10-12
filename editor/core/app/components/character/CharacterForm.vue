<script setup lang="ts">
import type { AdvCharacter, AdvVoiceCapabilities } from '@advjs/types'
import { validateCharacterVoiceProfile } from '@advjs/audio'
import { Toast } from '@advjs/gui'
import { useProjectDrafts } from '../../stores/useProjectDrafts'
import CharacterVoiceProfileEditor from './CharacterVoiceProfileEditor.vue'

const props = defineProps<{
  character?: Partial<AdvCharacter>
  mode?: 'create' | 'edit'
  save?: (data: Partial<AdvCharacter>, expected?: string | null) => Promise<void>
  voiceProviders?: Array<{ id: string, capabilities: AdvVoiceCapabilities }>
}>()

const emit = defineEmits<{
  submit: [data: Partial<AdvCharacter>]
  cancel: []
}>()

const fieldId = useId()

const { t } = useI18n()

const form = reactive<Partial<AdvCharacter>>({
  id: '',
  name: '',
  avatar: '',
  personality: '',
  appearance: '',
  background: '',
  concept: '',
  speechStyle: '',
  faction: '',
  tags: [],
  aliases: [],
  cv: '',
  actor: '',
  ...props.character,
  ...(props.character?.voiceProfile ? { voiceProfile: JSON.parse(JSON.stringify(props.character.voiceProfile)) } : {}),
})

const tagsInput = ref(Array.isArray(form.tags) ? form.tags.join(', ') : '')
const aliasInput = ref(
  Array.isArray(form.aliases)
    ? form.aliases.join(', ')
    : '',
)

// Avatar preview
const avatarValid = ref(false)
watch(() => form.avatar, (val) => {
  avatarValid.value = false
  if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
    const img = new Image()
    img.onload = () => {
      avatarValid.value = true
    }
    img.src = val
  }
}, { immediate: true })

// Character drafts belong to a single project, including their original source.
const drafts = useProjectDrafts()
const owner = drafts.projectId
const ownerWorkspace = useProjectStore().workspace
const draftKey = props.mode === 'edit' ? `character:edit:${props.character?.id}` : 'character:create'
const hasDraft = ref(Boolean(drafts.formDraft(draftKey)))
const characterStore = useCharacterStore()
const originalForm = ref(JSON.stringify(form))
const originalTags = ref(tagsInput.value)
const originalAliases = ref(aliasInput.value)
const expected = ref<string | null | undefined>(props.character?.id ? characterStore.characterSource(props.character.id) : undefined)
const saving = ref(false)
const saveError = ref('')
let active = true
let ownedDraftRevision: string | undefined
function formRevision() {
  return JSON.stringify({ form, tags: tagsInput.value, aliases: aliasInput.value })
}
const changed = computed(() => JSON.stringify(form) !== originalForm.value || tagsInput.value !== originalTags.value || aliasInput.value !== originalAliases.value)
function saveDraft() {
  if (!owner || drafts.projectId !== owner) {
    saveError.value = t('characters.draft.openProject')
    return
  }
  ownedDraftRevision = formRevision()
  drafts.saveFormDraft(draftKey, { base: expected.value ?? null, content: ownedDraftRevision }, owner)
  hasDraft.value = true
  if (!drafts.recoveryError)
    Toast({ title: t('characters.draft.saved'), type: 'success' })
}
function replaceForm(value: Partial<AdvCharacter>) {
  // Recovery and external reload are full snapshots, including cleared fields.
  for (const key of Object.keys(form))
    delete form[key as keyof AdvCharacter]
  Object.assign(form, JSON.parse(JSON.stringify(value)))
}
function loadDraft() {
  const draft = drafts.formDraft(draftKey)
  if (!draft || drafts.projectId !== owner)
    return
  try {
    const value = JSON.parse(draft.content)
    if (!value.form || typeof value.form !== 'object' || Array.isArray(value.form) || typeof value.tags !== 'string' || typeof value.aliases !== 'string')
      return
    replaceForm(value.form)
    tagsInput.value = value.tags
    aliasInput.value = value.aliases
    expected.value = draft.base
    saveError.value = props.mode === 'edit' && characterStore.characterSource(props.character?.id ?? '') !== draft.base
      ? t('characters.draft.conflict')
      : ''
  }
  catch {
    saveError.value = t('characters.draft.unreadable')
  }
}
function clearDraft(expectedContent?: string) {
  if (expectedContent === undefined)
    drafts.saveFormDraft(draftKey, undefined, owner)
  else
    drafts.saveFormDraft(draftKey, undefined, owner, expectedContent)
  hasDraft.value = Boolean(drafts.formDraft(draftKey))
}

watch(changed, (dirty) => {
  if (useProjectStore().workspace === ownerWorkspace)
    drafts.register(fieldId, { dirty, save: onSubmit })
}, { immediate: true })
watch([form, tagsInput, aliasInput], () => {
  if (changed.value) {
    ownedDraftRevision = formRevision()
    drafts.saveFormDraft(draftKey, { base: expected.value ?? null, content: ownedDraftRevision }, owner)
  }
  else if (ownedDraftRevision !== undefined) {
    clearDraft(ownedDraftRevision)
    ownedDraftRevision = undefined
  }
}, { deep: true })
onBeforeUnmount(() => {
  active = false
  drafts.remove(fieldId)
})
function reloadExternal() {
  const current = characterStore.characters.find(item => item.id === form.id)
  if (!current) {
    saveError.value = t('characters.draft.deleted')
    return
  }
  replaceForm(current)
  tagsInput.value = current.tags?.join(', ') ?? ''
  aliasInput.value = current.aliases?.join(', ') ?? ''
  originalForm.value = JSON.stringify(form)
  originalTags.value = tagsInput.value
  originalAliases.value = aliasInput.value
  expected.value = current?.id ? characterStore.characterSource(current.id) : undefined
  saveError.value = ''
  clearDraft()
}
async function keepDraft() {
  expected.value = form.id ? characterStore.characterSource(form.id) : undefined
  await onSubmit()
}
async function onSubmit() {
  if (saving.value)
    return false
  if (useProjectStore().workspace !== ownerWorkspace) {
    saveError.value = t('characters.draft.projectChanged')
    return false
  }
  saving.value = true
  saveError.value = ''
  const submittedRevision = formRevision()
  const submittedBase = expected.value
  const snapshot = JSON.parse(JSON.stringify(form)) as Partial<AdvCharacter>
  const data = {
    ...snapshot,
    // Keep an explicit clear through the inspector's merge with the old character.
    voiceProfile: snapshot.voiceProfile,
    tags: tagsInput.value ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [],
    aliases: aliasInput.value ? aliasInput.value.split(',').map(a => a.trim()).filter(Boolean) : [],
  }
  try {
    if (data.voiceProfile)
      validateCharacterVoiceProfile(data.voiceProfile)
    if (props.save)
      await props.save(data, submittedBase)
    else emit('submit', data)
    if (useProjectStore().workspace !== ownerWorkspace)
      return false
    if (!active) {
      // An old component may acknowledge only its own saved revision. It must
      // never replace recovery written by a newly opened form.
      if (drafts.formDraft(draftKey)?.content === submittedRevision)
        clearDraft(submittedRevision)
      return !drafts.formDraft(draftKey)
    }
    const submitted = JSON.parse(submittedRevision)
    originalForm.value = JSON.stringify(submitted.form)
    originalTags.value = submitted.tags
    originalAliases.value = submitted.aliases
    if (formRevision() !== submittedRevision) {
      // The save callback does not return its exact committed source. Retain
      // the original base rather than trusting a potentially newer disk read.
      drafts.saveFormDraft(draftKey, { base: submittedBase ?? null, content: formRevision() }, owner)
      if (active)
        drafts.register(fieldId, { dirty: true, save: onSubmit })
      return false
    }
    clearDraft(submittedRevision)
    drafts.remove(fieldId)
    return true
  }
  catch (error) {
    saveError.value = String(error)
    return false
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="character-form flex flex-col h-full overflow-y-auto">
    <div v-if="saveError" class="ae-resource-error p-2" role="alert">
      {{ saveError }}
      <div v-if="mode === 'edit'" class="ae-resource-actions">
        <AGUIButton @click="reloadExternal">
          {{ $t('characters.draft.reloadExternal') }}
        </AGUIButton>
        <AGUIButton @click="keepDraft">
          {{ $t('characters.draft.keepDraft') }}
        </AGUIButton>
      </div>
    </div>
    <!-- Draft notice -->
    <div v-if="hasDraft" class="text-xs text-$agui-c-warning-text px-3 py-2 flex flex-wrap gap-2 items-center justify-between">
      <span>{{ $t('characters.draft.hasDraft') }}</span>
      <AGUIButton size="mini" @click="loadDraft">
        {{ $t('characters.form.loadDraft') }}
      </AGUIButton>
    </div>

    <div class="flex-1">
      <AGUIForm @submit.prevent="onSubmit">
        <AGUIDetails :title="$t('characters.form.basicInfo')" open>
          <AGUIProperty :for="`${fieldId}-id`" :label="$t('characters.form.id')">
            <AGUIInput :id="`${fieldId}-id`" v-model="form.id" :placeholder="$t('characters.form.idPlaceholder')" :disabled="mode === 'edit'" />
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-name`" :label="$t('characters.form.name')">
            <AGUIInput :id="`${fieldId}-name`" v-model="form.name" :placeholder="$t('characters.form.namePlaceholder')" />
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-avatar`" :label="$t('characters.form.avatar')">
            <div class="flex gap-2 min-w-0 items-center">
              <AGUIInput :id="`${fieldId}-avatar`" v-model="form.avatar" :placeholder="$t('characters.form.avatarPlaceholder')" class="flex-1 min-w-0" />
              <img
                v-if="form.avatar && avatarValid"
                class="rounded size-8 object-cover"
                :src="form.avatar"
                :alt="form.name || 'avatar'"
              >
              <div v-else class="rounded bg-$agui-c-control flex size-8 items-center justify-center">
                <div class="i-ri-image-line text-lg op-30" />
              </div>
            </div>
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-cv`" :label="$t('characters.form.cv')">
            <AGUIInput :id="`${fieldId}-cv`" v-model="form.cv" :placeholder="$t('characters.form.cvPlaceholder')" />
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-actor`" :label="$t('characters.form.actor')">
            <AGUIInput :id="`${fieldId}-actor`" v-model="form.actor" :placeholder="$t('characters.form.actorPlaceholder')" />
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-faction`" :label="$t('characters.form.faction')">
            <AGUIInput :id="`${fieldId}-faction`" v-model="form.faction" :placeholder="$t('characters.form.factionPlaceholder')" />
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-tags`" :label="$t('characters.form.tags')">
            <AGUIInput :id="`${fieldId}-tags`" v-model="tagsInput" :placeholder="$t('characters.form.tagsPlaceholder')" />
          </AGUIProperty>

          <AGUIProperty :for="`${fieldId}-aliases`" :label="$t('characters.form.aliases')">
            <AGUIInput :id="`${fieldId}-aliases`" v-model="aliasInput" :placeholder="$t('characters.form.aliasesPlaceholder')" />
          </AGUIProperty>
        </AGUIDetails>

        <CharacterVoiceProfileEditor v-model="form.voiceProfile" :id-prefix="fieldId" :providers="voiceProviders" />

        <AGUIDetails :title="$t('characters.form.detailedDescription')" open>
          <AGUIFormItem :for="`${fieldId}-personality`" :label="$t('characters.form.personality')" label-align="top">
            <AGUITextarea :id="`${fieldId}-personality`" v-model="form.personality" :placeholder="$t('characters.form.personalityPlaceholder')" :rows="3" />
          </AGUIFormItem>

          <AGUIFormItem :for="`${fieldId}-appearance`" :label="$t('characters.form.appearance')" label-align="top">
            <AGUITextarea :id="`${fieldId}-appearance`" v-model="form.appearance" :placeholder="$t('characters.form.appearancePlaceholder')" :rows="3" />
          </AGUIFormItem>

          <AGUIFormItem :for="`${fieldId}-background`" :label="$t('characters.form.background')" label-align="top">
            <AGUITextarea :id="`${fieldId}-background`" v-model="form.background" :placeholder="$t('characters.form.backgroundPlaceholder')" :rows="3" />
          </AGUIFormItem>

          <AGUIFormItem :for="`${fieldId}-concept`" :label="$t('characters.form.concept')" label-align="top">
            <AGUIInput :id="`${fieldId}-concept`" v-model="form.concept" :placeholder="$t('characters.form.conceptPlaceholder')" />
          </AGUIFormItem>

          <AGUIFormItem :for="`${fieldId}-speechStyle`" :label="$t('characters.form.speechStyle')" label-align="top">
            <AGUITextarea :id="`${fieldId}-speechStyle`" v-model="form.speechStyle" :placeholder="$t('characters.form.speechStylePlaceholder')" :rows="2" />
          </AGUIFormItem>
        </AGUIDetails>
      </AGUIForm>
    </div>

    <!-- Sticky bottom buttons -->
    <div class="px-3 py-2 border-t border-$agui-c-divider bg-$agui-c-bg-panel flex flex-wrap gap-1 bottom-0 justify-end sticky">
      <AGUIButton v-if="mode === 'create'" size="mini" @click="saveDraft">
        {{ $t('characters.form.saveDraft') }}
      </AGUIButton>
      <AGUIButton @click="$emit('cancel')">
        {{ $t('characters.form.cancel') }}
      </AGUIButton>
      <AGUIButton theme="primary" type="submit" @click="onSubmit">
        {{ mode === 'edit' ? $t('characters.form.save') : $t('characters.form.create') }}
      </AGUIButton>
    </div>
  </div>
</template>
