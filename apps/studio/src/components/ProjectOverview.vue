<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { ChapterFormData } from '../utils/chapterMd'
import type { SceneFormData } from '../utils/sceneMd'
import { parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import {
  IonButton,
  IonIcon,
  IonLabel,
  IonListHeader,
  IonNote,
  toastController,
} from '@ionic/vue'
import { addOutline, bookOutline, imageOutline, peopleOutline } from 'ionicons/icons'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useContentEditor } from '../composables/useContentEditor'
import { useContentSave } from '../composables/useContentSave'
import { useProjectContent } from '../composables/useProjectContent'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { stringifyChapterMd } from '../utils/chapterMd'
import { parseSceneMd, stringifySceneMd } from '../utils/sceneMd'
import AiGeneratePanel from './AiGeneratePanel.vue'
import ChapterCard from './ChapterCard.vue'
import ChapterEditorForm from './ChapterEditorForm.vue'
import CharacterCard from './CharacterCard.vue'
import CharacterEditorForm from './CharacterEditorForm.vue'
import ContentEditorModal from './ContentEditorModal.vue'
import SceneCard from './SceneCard.vue'
import SceneEditorForm from './SceneEditorForm.vue'

const { t } = useI18n()
const router = useRouter()
const aiSettings = useAiSettingsStore()

const {
  chapters,
  characters,
  scenes,
  stats,
  isLoading,
  reload,
  getDirHandle,
} = useProjectContent()

const { isSaving, saveContent } = useContentSave()

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
    // If md is invalid, keep formData unchanged; user can fix in markdown view
  }
}

function handleAiApplyCharacter(md: string) {
  markdownToCharacter(md)
}

// --- Scene editor ---
const sceneEditor = useContentEditor<SceneFormData>('scene', () => ({
  id: '',
  name: '',
  description: '',
  imagePrompt: '',
  type: 'image' as const,
  tags: [],
}))
const sceneMarkdown = ref('')

function sceneToMarkdown() {
  sceneMarkdown.value = stringifySceneMd(sceneEditor.formData.value)
}

function markdownToScene(md: string) {
  sceneMarkdown.value = md
  try {
    const parsed = parseSceneMd(md)
    sceneEditor.formData.value = parsed
  }
  catch {
    // keep formData unchanged on parse failure
  }
}

function handleAiApplyScene(md: string) {
  markdownToScene(md)
}

// --- Chapter editor ---
const chapterEditor = useContentEditor<ChapterFormData>('chapter', () => ({
  filename: '',
  title: '',
  plotSummary: '',
  content: '',
}))
const chapterMarkdown = ref('')

function chapterToMarkdown() {
  // For chapters, the "markdown" IS the .adv.md content
  chapterMarkdown.value = stringifyChapterMd(chapterEditor.formData.value)
}

function markdownToChapter(md: string) {
  chapterMarkdown.value = md
  chapterEditor.formData.value = {
    ...chapterEditor.formData.value,
    content: md,
  }
}

function handleAiApplyChapter(md: string) {
  markdownToChapter(md)
}

// --- Navigation ---
function handleEditChapter(file: string) {
  router.push(`/editor?file=${encodeURIComponent(file)}`)
}

function handlePlayChapter(file: string) {
  router.push(`/tabs/play?file=${encodeURIComponent(file)}`)
}

function handleEditCharacter(character: AdvCharacter) {
  characterEditor.openEdit(character)
  characterMarkdown.value = stringifyCharacterMd(character)
}

function handleEditScene(scene: { file: string, name: string, id?: string, description?: string, imagePrompt?: string, type?: 'image' | 'model', tags?: string[] }) {
  const sceneData: SceneFormData = {
    id: scene.id || scene.name,
    name: scene.name,
    description: scene.description,
    imagePrompt: scene.imagePrompt,
    type: scene.type || 'image',
    tags: scene.tags,
  }
  sceneEditor.openEdit(sceneData)
  sceneMarkdown.value = stringifySceneMd(sceneData)
}

// --- Toast ---
async function showToast(message: string, color: string = 'success') {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color,
    position: 'bottom',
  })
  await toast.present()
}

// --- Save handlers ---
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

async function handleSaveScene() {
  const errors = sceneEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }

  const result = await saveContent(dirHandle, 'scene', sceneEditor.mode.value, sceneEditor.formData.value, sceneEditor.originalId.value)
  if (result.success) {
    await showToast(t('contentEditor.saveSuccess'))
    sceneEditor.onSaved()
    sceneEditor.close()
    await reload()
  }
  else {
    await showToast(t('contentEditor.saveFailed', { error: result.error }), 'danger')
  }
}

async function handleSaveChapter() {
  const errors = chapterEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }

  const result = await saveContent(dirHandle, 'chapter', chapterEditor.mode.value, chapterEditor.formData.value, chapterEditor.originalId.value)
  if (result.success) {
    await showToast(t('contentEditor.saveSuccess'))
    chapterEditor.onSaved()
    chapterEditor.close()
    await reload()
  }
  else {
    await showToast(t('contentEditor.saveFailed', { error: result.error }), 'danger')
  }
}
</script>

<template>
  <div class="project-overview">
    <!-- Loading indicator -->
    <div v-if="isLoading" class="overview-loading">
      {{ t('preview.loadingGame') }}
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--primary">
          <IonIcon :icon="bookOutline" />
        </div>
        <span class="stat-card__value">{{ stats.chapters }}</span>
        <span class="stat-card__label">{{ t('preview.chaptersCount') }}</span>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--purple">
          <IonIcon :icon="peopleOutline" />
        </div>
        <span class="stat-card__value">{{ stats.characters }}</span>
        <span class="stat-card__label">{{ t('preview.charactersCount') }}</span>
      </div>
      <div class="stat-card">
        <div class="stat-card__icon stat-card__icon--teal">
          <IonIcon :icon="imageOutline" />
        </div>
        <span class="stat-card__value">{{ stats.scenes }}</span>
        <span class="stat-card__label">{{ t('workspace.scenes') }}</span>
      </div>
    </div>

    <!-- Chapters Section -->
    <IonListHeader>
      <IonLabel>{{ t('preview.chapters') }}</IonLabel>
      <IonButton fill="clear" size="small" @click="chapterEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonButton>
    </IonListHeader>
    <div v-if="chapterEditor.hasDraft.value" class="draft-banner-wrapper">
      <div class="draft-banner">
        <span>{{ t('contentEditor.draftFound', { type: t('contentEditor.createChapter') }) }}</span>
        <div class="draft-banner__actions">
          <IonButton fill="solid" size="small" @click="chapterEditor.restoreDraft()">
            {{ t('contentEditor.restoreDraft') }}
          </IonButton>
          <IonButton fill="clear" size="small" color="medium" @click="chapterEditor.clearDraft()">
            {{ t('contentEditor.discardDraft') }}
          </IonButton>
        </div>
      </div>
    </div>
    <div v-if="chapters.length > 0" class="card-list">
      <ChapterCard
        v-for="chapter in chapters"
        :key="chapter.file"
        :chapter="chapter"
        @edit="handleEditChapter"
        @play="handlePlayChapter"
      />
    </div>
    <IonNote v-else class="empty-note">
      {{ t('preview.noChapters') }}
    </IonNote>

    <!-- Characters Section -->
    <IonListHeader>
      <IonLabel>{{ t('workspace.characters') }}</IonLabel>
      <IonButton fill="clear" size="small" @click="characterEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonButton>
    </IonListHeader>
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
    <div v-if="characters.length > 0" class="card-grid">
      <CharacterCard
        v-for="character in characters"
        :key="character.id"
        :character="character"
        @click="handleEditCharacter"
      />
    </div>
    <IonNote v-else class="empty-note">
      {{ t('workspace.noCharacters') }}
    </IonNote>

    <!-- Scenes Section -->
    <IonListHeader>
      <IonLabel>{{ t('workspace.scenes') }}</IonLabel>
      <IonButton fill="clear" size="small" @click="sceneEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonButton>
    </IonListHeader>
    <div v-if="sceneEditor.hasDraft.value" class="draft-banner-wrapper">
      <div class="draft-banner">
        <span>{{ t('contentEditor.draftFound', { type: t('contentEditor.createScene') }) }}</span>
        <div class="draft-banner__actions">
          <IonButton fill="solid" size="small" @click="sceneEditor.restoreDraft()">
            {{ t('contentEditor.restoreDraft') }}
          </IonButton>
          <IonButton fill="clear" size="small" color="medium" @click="sceneEditor.clearDraft()">
            {{ t('contentEditor.discardDraft') }}
          </IonButton>
        </div>
      </div>
    </div>
    <div v-if="scenes.length > 0" class="card-grid">
      <SceneCard
        v-for="scene in scenes"
        :key="scene.file"
        :scene="scene"
        @click="handleEditScene(scene)"
      />
    </div>
    <IonNote v-else class="empty-note">
      {{ t('workspace.noScenes') }}
    </IonNote>

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
    </ContentEditorModal>

    <!-- Scene Editor Modal -->
    <ContentEditorModal
      :is-open="sceneEditor.isOpen.value"
      :title="sceneEditor.mode.value === 'create' ? t('contentEditor.createScene') : t('contentEditor.editScene')"
      :mode="sceneEditor.mode.value"
      :is-saving="isSaving"
      :ai-enabled="aiSettings.isConfigured"
      :markdown="sceneMarkdown"
      :monaco-filename="`${sceneEditor.formData.value.id || 'scene'}.md`"
      @update:is-open="(v: boolean) => { if (!v) sceneEditor.close() }"
      @update:markdown="sceneMarkdown = $event"
      @sync-to-markdown="sceneToMarkdown()"
      @sync-from-markdown="markdownToScene($event)"
      @save="handleSaveScene"
      @cancel="sceneEditor.close()"
    >
      <template #form>
        <SceneEditorForm v-model="sceneEditor.formData.value" />
      </template>
      <template #ai>
        <AiGeneratePanel content-type="scene" @apply="handleAiApplyScene" />
      </template>
    </ContentEditorModal>

    <!-- Chapter Editor Modal -->
    <ContentEditorModal
      :is-open="chapterEditor.isOpen.value"
      :title="chapterEditor.mode.value === 'create' ? t('contentEditor.createChapter') : t('contentEditor.editChapter')"
      :mode="chapterEditor.mode.value"
      :is-saving="isSaving"
      :ai-enabled="aiSettings.isConfigured"
      :markdown="chapterMarkdown"
      :monaco-filename="`${chapterEditor.formData.value.filename || 'chapter'}.adv.md`"
      @update:is-open="(v: boolean) => { if (!v) chapterEditor.close() }"
      @update:markdown="chapterMarkdown = $event"
      @sync-to-markdown="chapterToMarkdown()"
      @sync-from-markdown="markdownToChapter($event)"
      @save="handleSaveChapter"
      @cancel="chapterEditor.close()"
    >
      <template #form>
        <ChapterEditorForm v-model="chapterEditor.formData.value" />
      </template>
      <template #ai>
        <AiGeneratePanel content-type="chapter" @apply="handleAiApplyChapter" />
      </template>
    </ContentEditorModal>
  </div>
</template>

<style scoped>
.project-overview {
  padding-bottom: var(--adv-space-lg);
}

.overview-loading {
  text-align: center;
  padding: var(--adv-space-lg);
  color: var(--adv-text-tertiary);
}

/* Stats grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--adv-space-xs);
  padding: var(--adv-space-md);
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
}

.stat-card__icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.stat-card__icon--primary {
  background: rgba(99, 102, 241, 0.1);
  color: var(--ion-color-primary);
}

.stat-card__icon--purple {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.stat-card__icon--teal {
  background: rgba(20, 184, 166, 0.1);
  color: #14b8a6;
}

.stat-card__value {
  font-size: var(--adv-font-title);
  font-weight: 800;
  color: var(--adv-text-primary);
  line-height: 1;
}

.stat-card__label {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
}

/* Card list and grid */
.card-list {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: 0 var(--adv-space-md);
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--adv-space-sm);
  padding: 0 var(--adv-space-md);
}

.empty-note {
  display: block;
  padding: var(--adv-space-md);
  text-align: center;
  color: var(--adv-text-tertiary);
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
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--adv-space-xs);
  }

  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
