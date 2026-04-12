<script setup lang="ts">
import type { SceneInfo } from '../../composables/useProjectContent'
import type { SceneFormData } from '../../utils/sceneMd'
import {
  IonButton,
  IonFab,
  IonFabButton,
  IonIcon,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AiGeneratePanel from '../../components/AiGeneratePanel.vue'
import DraftRestoreBanner from '../../components/common/DraftRestoreBanner.vue'
import LayoutPage from '../../components/common/LayoutPage.vue'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import SceneCard from '../../components/SceneCard.vue'
import SceneEditorForm from '../../components/SceneEditorForm.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useRecentActivity } from '../../composables/useRecentActivity'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { generateImage, isImageGenerationAvailable } from '../../utils/aiImageClient'
import { writeBlobToDir, writeFileToDir } from '../../utils/fileAccess'
import { parseSceneMd, stringifySceneMd } from '../../utils/sceneMd'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const aiSettings = useAiSettingsStore()

const { scenes, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()
const { trackAccess } = useRecentActivity()

const generatingSceneIds = ref(new Set<string>())
const aiImageAvailable = computed(() => isImageGenerationAvailable(aiSettings.config))

// --- AI Image Generation ---
async function handleGenerateImage(scene: SceneInfo) {
  if (!scene.imagePrompt || !scene.id)
    return

  const sceneId = scene.id
  generatingSceneIds.value.add(sceneId)

  try {
    const result = await generateImage(
      { prompt: scene.imagePrompt, width: 768, height: 432 },
      aiSettings.config,
    )

    // Download the image and save to project
    const dirHandle = getDirHandle()
    if (dirHandle && result.url) {
      const response = await fetch(result.url)
      const blob = await response.blob()
      const ext = blob.type.includes('webp') ? 'webp' : blob.type.includes('png') ? 'png' : 'jpg'
      const imagePath = `adv/scenes/${sceneId}.${ext}`
      await writeBlobToDir(dirHandle, imagePath, blob)

      // Update scene frontmatter with src
      const sceneMdPath = `adv/scenes/${sceneId}.md`
      try {
        const { readFileFromDir } = await import('../../utils/fileAccess')
        const content = await readFileFromDir(dirHandle, sceneMdPath)
        const parsed = parseSceneMd(content)
        parsed.src = `${sceneId}.${ext}`
        const newContent = stringifySceneMd(parsed)
        await writeFileToDir(dirHandle, sceneMdPath, newContent)
      }
      catch {
        // Scene md not found — create one
        const newContent = stringifySceneMd({
          id: sceneId,
          name: scene.name,
          imagePrompt: scene.imagePrompt,
          src: `${sceneId}.${ext}`,
          type: 'image',
        })
        await writeFileToDir(dirHandle, sceneMdPath, newContent)
      }

      await reload()
      await showToast(t('scenes.imageGenerated'))
    }
  }
  catch (err) {
    await showToast(t('scenes.imageGenerateFailed', { error: err instanceof Error ? err.message : 'Unknown' }), 'danger')
  }
  finally {
    generatingSceneIds.value.delete(sceneId)
  }
}

// --- Search ---
const searchQuery = ref('')
const filteredScenes = computed<SceneInfo[]>(() => {
  if (!searchQuery.value)
    return scenes.value
  const q = searchQuery.value.toLowerCase()
  return scenes.value.filter(s =>
    s.name.toLowerCase().includes(q)
    || s.description?.toLowerCase().includes(q)
    || s.tags?.some(tag => tag.toLowerCase().includes(q)),
  )
})

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

function handleEditScene(scene: SceneInfo) {
  trackAccess({ id: scene.file, label: scene.name, type: 'scene', action: 'edit' })
  const sceneData: SceneFormData = {
    id: scene.id || scene.name,
    name: scene.name,
    description: scene.description,
    imagePrompt: scene.imagePrompt,
    type: scene.type || 'image',
    tags: scene.tags,
    linkedLocation: scene.linkedLocation,
  }
  sceneEditor.openEdit(sceneData)
  sceneMarkdown.value = stringifySceneMd(sceneData)
}

// --- Save ---
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

// --- Delete ---
async function handleDeleteScene(scene: SceneFormData) {
  const filePath = `adv/scenes/${scene.id}.md`
  const deleted = await deleteFile(filePath, t('scenes.confirmDelete', { name: scene.name || scene.id }))
  if (deleted) {
    sceneEditor.close()
  }
}
</script>

<template>
  <LayoutPage :title="t('workspace.scenes')" show-back-button default-href="/tabs/workspace">
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
      v-if="sceneEditor.hasDraft.value"
      :message="t('contentEditor.draftFound', { type: t('contentEditor.createScene') })"
      @restore="sceneEditor.restoreDraft()"
      @discard="sceneEditor.clearDraft()"
    />

    <!-- Scene grid -->
    <div v-if="filteredScenes.length > 0" class="card-grid">
      <IonItemSliding v-for="scene in filteredScenes" :key="scene.file">
        <SceneCard
          :scene="scene"
          :is-generating="generatingSceneIds.has(scene.id || '')"
          :ai-available="aiImageAvailable"
          @click="handleEditScene(scene)"
          @generate-image="handleGenerateImage"
        />
        <IonItemOptions side="end">
          <IonItemOption color="danger" @click="handleDeleteScene({ id: scene.id || scene.name, name: scene.name, description: scene.description, imagePrompt: scene.imagePrompt, type: scene.type || 'image', tags: scene.tags })">
            <IonIcon :icon="trashOutline" />
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    </div>

    <!-- Empty state -->
    <div v-else-if="searchQuery" class="empty-state">
      <IonNote>{{ t('scenes.emptySearch') }}</IonNote>
    </div>
    <div v-else class="empty-state">
      <div class="empty-state__illustration">
        🎬
      </div>
      <p class="empty-state__title">
        {{ t('workspace.noScenes') }}
      </p>
      <IonButton fill="outline" size="small" @click="sceneEditor.openCreate()">
        <IonIcon :icon="addOutline" />
        {{ t('contentEditor.createScene') }}
      </IonButton>
    </div>

    <!-- FAB add button -->
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton @click="sceneEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

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
      <template #header-actions>
        <IonButton
          v-if="sceneEditor.mode.value === 'edit'"
          fill="clear"
          color="danger"
          size="small"
          @click="handleDeleteScene(sceneEditor.formData.value)"
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

@media (max-width: 767px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
