<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonNote,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AiGeneratePanel from '../../components/AiGeneratePanel.vue'
import CharacterCard from '../../components/CharacterCard.vue'
import CharacterEditorForm from '../../components/CharacterEditorForm.vue'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useRecentActivity } from '../../composables/useRecentActivity'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const aiSettings = useAiSettingsStore()

const { characters, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()
const { trackAccess } = useRecentActivity()

// --- Search ---
const searchQuery = ref('')
const filteredCharacters = computed<AdvCharacter[]>(() => {
  if (!searchQuery.value)
    return characters.value
  const q = searchQuery.value.toLowerCase()
  return characters.value.filter(c =>
    c.name.toLowerCase().includes(q)
    || c.id.toLowerCase().includes(q)
    || c.tags?.some(tag => tag.toLowerCase().includes(q))
    || c.faction?.toLowerCase().includes(q),
  )
})

// --- Character editor ---
const characterEditor = useContentEditor<AdvCharacter>('character', () => ({
  id: '',
  name: '',
  tags: [],
  faction: '',
  appearance: '',
  personality: '',
  background: '',
  concept: '',
  speechStyle: '',
  relationships: [],
}))
const characterMarkdown = ref('')

function characterToMarkdown() {
  characterMarkdown.value = stringifyCharacterMd(characterEditor.formData.value)
}

function markdownToCharacter(md: string) {
  characterMarkdown.value = md
  try {
    const parsed = parseCharacterMd(md)
    characterEditor.formData.value = parsed
  }
  catch {
    // If md is invalid, keep formData unchanged
  }
}

function handleAiApplyCharacter(md: string) {
  markdownToCharacter(md)
}

function handleEditCharacter(character: AdvCharacter) {
  trackAccess({ id: character.id, label: character.name, type: 'character' })
  characterEditor.openEdit(character)
  characterMarkdown.value = stringifyCharacterMd(character)
}

// --- Save ---
async function handleSaveCharacter() {
  const errors = characterEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }

  const result = await saveContent(dirHandle, 'character', characterEditor.mode.value, characterEditor.formData.value, characterEditor.originalId.value)
  if (result.success) {
    await showToast(t('contentEditor.saveSuccess'))
    characterEditor.onSaved()
    characterEditor.close()
    await reload()
  }
  else {
    await showToast(t('contentEditor.saveFailed', { error: result.error }), 'danger')
  }
}

// --- Delete ---
async function handleDeleteCharacter(character: AdvCharacter) {
  const filePath = `adv/characters/${character.id}.character.md`
  const deleted = await deleteFile(filePath, t('characters.confirmDelete', { name: character.name }))
  if (deleted) {
    characterEditor.close()
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/workspace" />
        </IonButtons>
        <IonTitle>{{ t('workspace.characters') }}</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar
          v-model="searchQuery"
          :placeholder="t('common.search')"
          :debounce="300"
          animated
        />
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Draft restore banner -->
      <div v-if="characterEditor.hasDraft.value" class="draft-banner-wrapper">
        <div class="draft-banner">
          <span>{{ t('contentEditor.draftFound', { type: t('contentEditor.createCharacter') }) }}</span>
          <div class="draft-banner__actions">
            <IonButton fill="solid" size="small" @click="characterEditor.restoreDraft()">
              {{ t('contentEditor.restoreDraft') }}
            </IonButton>
            <IonButton fill="clear" size="small" color="medium" @click="characterEditor.clearDraft()">
              {{ t('contentEditor.discardDraft') }}
            </IonButton>
          </div>
        </div>
      </div>

      <!-- Character grid -->
      <div v-if="filteredCharacters.length > 0" class="card-grid">
        <CharacterCard
          v-for="character in filteredCharacters"
          :key="character.id"
          :character="character"
          @click="handleEditCharacter"
        />
      </div>

      <!-- Empty state -->
      <div v-else-if="searchQuery" class="empty-state">
        <IonNote>{{ t('characters.emptySearch') }}</IonNote>
      </div>
      <div v-else class="empty-state">
        <div class="empty-state__illustration">
          👤
        </div>
        <p class="empty-state__title">
          {{ t('workspace.noCharacters') }}
        </p>
        <IonButton fill="outline" size="small" @click="characterEditor.openCreate()">
          <IonIcon :icon="addOutline" />
          {{ t('contentEditor.createCharacter') }}
        </IonButton>
      </div>

      <!-- FAB add button -->
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="characterEditor.openCreate()">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <!-- Character Editor Modal -->
      <ContentEditorModal
        :is-open="characterEditor.isOpen.value"
        :title="characterEditor.mode.value === 'create' ? t('contentEditor.createCharacter') : t('contentEditor.editCharacter')"
        :mode="characterEditor.mode.value"
        :is-saving="isSaving"
        :ai-enabled="aiSettings.isConfigured"
        :markdown="characterMarkdown"
        :monaco-filename="`${characterEditor.formData.value.id || 'character'}.character.md`"
        @update:is-open="(v: boolean) => { if (!v) characterEditor.close() }"
        @update:markdown="characterMarkdown = $event"
        @sync-to-markdown="characterToMarkdown()"
        @sync-from-markdown="markdownToCharacter($event)"
        @save="handleSaveCharacter"
        @cancel="characterEditor.close()"
      >
        <template #form>
          <CharacterEditorForm v-model="characterEditor.formData.value" :characters="characters" />
        </template>
        <template #ai>
          <AiGeneratePanel content-type="character" @apply="handleAiApplyCharacter" />
        </template>
        <template #header-actions>
          <IonButton
            v-if="characterEditor.mode.value === 'edit'"
            fill="clear"
            color="danger"
            size="small"
            @click="handleDeleteCharacter(characterEditor.formData.value)"
          >
            <IonIcon :icon="trashOutline" />
          </IonButton>
        </template>
      </ContentEditorModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-xl) var(--adv-space-md);
  text-align: center;
  gap: var(--adv-space-sm);
}

.empty-state__illustration {
  font-size: 48px;
  opacity: 0.6;
}

.empty-state__title {
  font-size: var(--adv-font-body);
  color: var(--adv-text-tertiary);
  margin: 0;
}

/* Draft restore banners */
.draft-banner-wrapper {
  padding: var(--adv-space-xs) var(--adv-space-md) 0;
}

.draft-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-sm) var(--adv-space-md);
  border-radius: var(--adv-radius-md);
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-primary);
}

.draft-banner__actions {
  display: flex;
  gap: var(--adv-space-xs);
  flex-shrink: 0;
}

@media (max-width: 767px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
