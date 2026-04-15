<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import {
  actionSheetController,
  IonButton,
  IonIcon,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, cloudUploadOutline, downloadOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AiGeneratePanel from '../../components/AiGeneratePanel.vue'
import CharacterCard from '../../components/CharacterCard.vue'
import CharacterCardActions from '../../components/CharacterCardActions.vue'
import CharacterEditorForm from '../../components/CharacterEditorForm.vue'
import DraftRestoreBanner from '../../components/common/DraftRestoreBanner.vue'
import LayoutPage from '../../components/common/LayoutPage.vue'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useRecentActivity } from '../../composables/useRecentActivity'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { useCharacterStateStore } from '../../stores/useCharacterStateStore'
import { exportCharactersToCSV, exportRelationshipsToCSV } from '../../utils/csvExport'
import { downloadAsFile } from '../../utils/fileAccess'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const router = useRouter()
const aiSettings = useAiSettingsStore()
const characterStateStore = useCharacterStateStore()

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
  trackAccess({ id: character.id, label: character.name, type: 'character', action: 'edit', avatar: character.avatar })
  characterEditor.openEdit(character)
  characterMarkdown.value = stringifyCharacterMd(character)
}

function goToChat(character: AdvCharacter) {
  router.push(`/tabs/world/chat/${character.id}`)
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

async function handleExportCSV() {
  if (characters.value.length === 0) {
    showToast(t('characters.emptySearch'), 'warning')
    return
  }
  const sheet = await actionSheetController.create({
    header: t('world.exportTitle'),
    buttons: [
      {
        text: t('characters.exportCharacters'),
        handler: () => {
          const csv = exportCharactersToCSV(characters.value)
          downloadAsFile(csv, 'characters.csv', 'text/csv;charset=utf-8')
        },
      },
      {
        text: t('characters.exportRelationships'),
        handler: () => {
          const csv = exportRelationshipsToCSV(characters.value)
          downloadAsFile(csv, 'relationships.csv', 'text/csv;charset=utf-8')
        },
      },
      { text: t('common.cancel'), role: 'cancel' },
    ],
  })
  await sheet.present()
}
</script>

<template>
  <LayoutPage :title="t('workspace.characters')" show-back-button default-href="/tabs/workspace">
    <template #end>
      <IonButton fill="clear" @click="handleExportCSV">
        <IonIcon :icon="downloadOutline" />
      </IonButton>
      <IonButton router-link="/tabs/workspace/batch-import" fill="clear">
        <IonIcon :icon="cloudUploadOutline" />
      </IonButton>
      <IonButton @click="characterEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonButton>
    </template>
    <template #header-extra>
      <IonToolbar>
        <IonSearchbar
          v-model="searchQuery"
          :placeholder="t('common.search')"
          :debounce="300"
          animated
        />
      </IonToolbar>
    </template>

    <IonRefresher slot="fixed" @ion-refresh="async (e: CustomEvent) => { await reload(); (e.target as HTMLIonRefresherElement).complete() }">
      <IonRefresherContent />
    </IonRefresher>

    <!-- Draft restore banner -->
    <DraftRestoreBanner
      v-if="characterEditor.hasDraft.value"
      :message="t('contentEditor.draftFound', { type: t('contentEditor.createCharacter') })"
      @restore="characterEditor.restoreDraft()"
      @discard="characterEditor.clearDraft()"
    />

    <!-- Character grid -->
    <div v-if="filteredCharacters.length > 0" class="card-grid">
      <CharacterCard
        v-for="character in filteredCharacters"
        :key="character.id"
        :character="character"
        :location="characterStateStore.getState(character.id).location"
        @click="handleEditCharacter"
      >
        <template #actions>
          <CharacterCardActions
            :character="character"
            @edit="handleEditCharacter"
            @chat="goToChat"
            @delete="handleDeleteCharacter"
          />
        </template>
      </CharacterCard>
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
  </LayoutPage>
</template>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--adv-space-sm, 10px);
  padding: var(--adv-space-md, 16px);
  box-sizing: border-box;
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

@media (max-width: 767px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
