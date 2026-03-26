<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { Toast } from '@advjs/gui/client/composables'

const props = defineProps<{
  character?: Partial<AdvCharacter>
  mode?: 'create' | 'edit'
}>()

const emit = defineEmits<{
  submit: [data: Partial<AdvCharacter>]
  cancel: []
}>()

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

// Draft functionality (create mode only)
const draft = useLocalStorage<Partial<AdvCharacter> | null>('advjs-character-draft', null)
const draftTagsInput = useLocalStorage('advjs-character-draft-tags', '')
const draftAliasInput = useLocalStorage('advjs-character-draft-alias', '')

const hasDraft = computed(() => props.mode === 'create' && draft.value !== null)

function saveDraft() {
  draft.value = { ...form }
  draftTagsInput.value = tagsInput.value
  draftAliasInput.value = aliasInput.value
  Toast({ title: t('characters.draft.saved'), type: 'success' })
}

function loadDraft() {
  if (draft.value) {
    Object.assign(form, draft.value)
    tagsInput.value = draftTagsInput.value || ''
    aliasInput.value = draftAliasInput.value || ''
    Toast({ title: t('characters.draft.loaded'), type: 'success' })
  }
}

function clearDraft() {
  draft.value = null
  draftTagsInput.value = ''
  draftAliasInput.value = ''
}

function onSubmit() {
  const data = {
    ...form,
    tags: tagsInput.value ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [],
    aliases: aliasInput.value ? aliasInput.value.split(',').map(a => a.trim()).filter(Boolean) : [],
  }
  emit('submit', data)

  // Auto-clear draft on successful create
  if (props.mode === 'create') {
    clearDraft()
  }
}
</script>

<template>
  <div class="character-form h-full flex flex-col overflow-y-auto">
    <!-- Draft notice -->
    <div v-if="hasDraft" class="flex items-center justify-between bg-yellow-900/30 px-4 py-2 text-sm text-yellow-200">
      <span>{{ $t('characters.draft.hasDraft') }}</span>
      <AGUIButton size="mini" @click="loadDraft">
        {{ $t('characters.form.loadDraft') }}
      </AGUIButton>
    </div>

    <div class="flex-1 p-4">
      <AGUIForm @submit.prevent="onSubmit">
        <!-- Basic Info Section -->
        <h3 class="mb-3 text-sm font-bold tracking-wide uppercase op-60">
          {{ $t('characters.form.basicInfo') }}
        </h3>

        <AGUIFormItem :label="$t('characters.form.id')" label-align="top">
          <AGUIInput v-model="form.id" :placeholder="$t('characters.form.idPlaceholder')" :disabled="mode === 'edit'" />
        </AGUIFormItem>

        <AGUIFormItem :label="$t('characters.form.name')" label-align="top">
          <AGUIInput v-model="form.name" :placeholder="$t('characters.form.namePlaceholder')" />
        </AGUIFormItem>

        <AGUIFormItem :label="$t('characters.form.avatar')" label-align="top">
          <div class="flex items-center gap-3">
            <AGUIInput v-model="form.avatar" :placeholder="$t('characters.form.avatarPlaceholder')" class="flex-1" />
            <img
              v-if="form.avatar && avatarValid"
              class="size-10 rounded-lg object-cover shadow"
              :src="form.avatar"
              :alt="form.name || 'avatar'"
            >
            <div v-else class="size-10 flex items-center justify-center rounded-lg bg-dark-200">
              <div class="i-ri-image-line text-lg op-30" />
            </div>
          </div>
        </AGUIFormItem>

        <div class="grid grid-cols-2 gap-4">
          <AGUIFormItem :label="$t('characters.form.cv')" label-align="top">
            <AGUIInput v-model="form.cv" :placeholder="$t('characters.form.cvPlaceholder')" />
          </AGUIFormItem>

          <AGUIFormItem :label="$t('characters.form.actor')" label-align="top">
            <AGUIInput v-model="form.actor" :placeholder="$t('characters.form.actorPlaceholder')" />
          </AGUIFormItem>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <AGUIFormItem :label="$t('characters.form.faction')" label-align="top">
            <AGUIInput v-model="form.faction" :placeholder="$t('characters.form.factionPlaceholder')" />
          </AGUIFormItem>

          <AGUIFormItem :label="$t('characters.form.tags')" label-align="top">
            <AGUIInput v-model="tagsInput" :placeholder="$t('characters.form.tagsPlaceholder')" />
          </AGUIFormItem>
        </div>

        <AGUIFormItem :label="$t('characters.form.aliases')" label-align="top">
          <AGUIInput v-model="aliasInput" :placeholder="$t('characters.form.aliasesPlaceholder')" />
        </AGUIFormItem>

        <!-- Detailed Description Section -->
        <h3 class="mb-3 mt-6 text-sm font-bold tracking-wide uppercase op-60">
          {{ $t('characters.form.detailedDescription') }}
        </h3>

        <AGUIFormItem :label="$t('characters.form.personality')" label-align="top">
          <AGUITextarea v-model="form.personality" :placeholder="$t('characters.form.personalityPlaceholder')" :rows="3" />
        </AGUIFormItem>

        <AGUIFormItem :label="$t('characters.form.appearance')" label-align="top">
          <AGUITextarea v-model="form.appearance" :placeholder="$t('characters.form.appearancePlaceholder')" :rows="3" />
        </AGUIFormItem>

        <AGUIFormItem :label="$t('characters.form.background')" label-align="top">
          <AGUITextarea v-model="form.background" :placeholder="$t('characters.form.backgroundPlaceholder')" :rows="3" />
        </AGUIFormItem>

        <AGUIFormItem :label="$t('characters.form.concept')" label-align="top">
          <AGUIInput v-model="form.concept" :placeholder="$t('characters.form.conceptPlaceholder')" />
        </AGUIFormItem>

        <AGUIFormItem :label="$t('characters.form.speechStyle')" label-align="top">
          <AGUITextarea v-model="form.speechStyle" :placeholder="$t('characters.form.speechStylePlaceholder')" :rows="2" />
        </AGUIFormItem>
      </AGUIForm>
    </div>

    <!-- Sticky bottom buttons -->
    <div class="sticky bottom-0 flex justify-end gap-2 border-t border-dark-200 bg-dark-300 px-4 py-3">
      <AGUIButton v-if="mode === 'create'" size="small" @click="saveDraft">
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
