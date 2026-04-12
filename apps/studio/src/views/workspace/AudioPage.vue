<script setup lang="ts">
import type { AudioInfo } from '../../composables/useProjectContent'
import type { AudioFormData } from '../../utils/audioMd'
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
import { addOutline, cloudUploadOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AiGeneratePanel from '../../components/AiGeneratePanel.vue'
import AudioCard from '../../components/AudioCard.vue'
import AudioEditorForm from '../../components/AudioEditorForm.vue'
import DraftRestoreBanner from '../../components/common/DraftRestoreBanner.vue'
import LayoutPage from '../../components/common/LayoutPage.vue'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { parseAudioMd, stringifyAudioMd } from '../../utils/audioMd'
import { isAudioFile, writeBlobToDir, writeFileToDir } from '../../utils/fileAccess'
import { showToast } from '../../utils/toast'

const FILE_NAME_RE = /[^\w\u4E00-\u9FFF-]/g

const { t } = useI18n()
const aiSettings = useAiSettingsStore()

const { audios, reload, getDirHandle } = useProjectContent()
const { isSaving } = useContentSave()
const { deleteFile } = useContentDelete()

// --- Search ---
const searchQuery = ref('')
const filteredAudios = computed<AudioInfo[]>(() => {
  if (!searchQuery.value)
    return audios.value
  const q = searchQuery.value.toLowerCase()
  return audios.value.filter(a =>
    a.name.toLowerCase().includes(q)
    || a.description?.toLowerCase().includes(q)
    || a.tags?.some(tag => tag.toLowerCase().includes(q)),
  )
})

// --- Audio editor ---
const audioEditor = useContentEditor<AudioFormData>('audio', () => ({
  name: '',
  description: '',
  tags: [],
  linkedScenes: [],
  linkedChapters: [],
}))
const audioMarkdown = ref('')

function audioToMarkdown() {
  audioMarkdown.value = stringifyAudioMd(audioEditor.formData.value)
}

function markdownToAudio(md: string) {
  audioMarkdown.value = md
  try {
    const parsed = parseAudioMd(md)
    audioEditor.formData.value = parsed
  }
  catch {
    // keep formData unchanged on parse failure
  }
}

function handleAiApplyAudio(md: string) {
  markdownToAudio(md)
}

function handleEditAudio(audio: AudioInfo) {
  const formData: AudioFormData = {
    name: audio.name,
    description: audio.description,
    src: audio.src,
    duration: audio.duration,
    tags: audio.tags,
    linkedScenes: audio.linkedScenes,
    linkedChapters: audio.linkedChapters,
  }
  audioEditor.openEdit(formData)
  audioMarkdown.value = stringifyAudioMd(formData)
}

// --- Save ---
async function handleSaveAudio() {
  const errors = audioEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }

  // Save as audio metadata markdown
  const data = audioEditor.formData.value
  const fileName = data.name.replace(FILE_NAME_RE, '_').toLowerCase()
  const filePath = `adv/audio/${fileName}.md`
  const content = stringifyAudioMd(data)

  try {
    await writeFileToDir(dirHandle, filePath, content)
    await showToast(t('contentEditor.saveSuccess'))
    audioEditor.onSaved()
    audioEditor.close()
    await reload()
  }
  catch (err) {
    await showToast(t('contentEditor.saveFailed', { error: err instanceof Error ? err.message : 'Unknown' }), 'danger')
  }
}

// --- Delete ---
async function handleDeleteAudio(audio: AudioInfo) {
  const deleted = await deleteFile(audio.file, t('audio.confirmDelete', { name: audio.name }))
  if (deleted) {
    audioEditor.close()
  }
}

// --- Import ---
const fileInput = ref<HTMLInputElement | null>(null)

function triggerImport() {
  fileInput.value?.click()
}

async function handleFileImport(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files?.length)
    return

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('audio.importFailed'), 'danger')
    return
  }

  let imported = 0
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (!isAudioFile(file.name))
      continue
    try {
      const path = `adv/audio/${file.name}`
      await writeBlobToDir(dirHandle, path, file)
      imported++
    }
    catch {
      // skip failed files
    }
  }

  // Reset input
  target.value = ''

  if (imported > 0) {
    await showToast(t('audio.importSuccess', { count: imported }))
    await reload()
  }
  else {
    await showToast(t('audio.importFailed'), 'warning')
  }
}
</script>

<template>
  <LayoutPage :title="t('audio.title')" show-back-button default-href="/tabs/workspace">
    <template #end>
      <IonButton @click="triggerImport">
        <IonIcon :icon="cloudUploadOutline" />
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
      v-if="audioEditor.hasDraft.value"
      :message="t('contentEditor.draftFound', { type: t('contentEditor.createAudio') })"
      @restore="audioEditor.restoreDraft()"
      @discard="audioEditor.clearDraft()"
    />

    <!-- Audio list -->
    <div v-if="filteredAudios.length > 0" class="card-list">
      <IonItemSliding v-for="audio in filteredAudios" :key="audio.file">
        <AudioCard
          :audio="audio"
          @click="handleEditAudio"
        />
        <IonItemOptions side="end">
          <IonItemOption color="danger" @click="handleDeleteAudio(audio)">
            <IonIcon :icon="trashOutline" />
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    </div>

    <!-- Empty state -->
    <div v-else-if="searchQuery" class="empty-state">
      <IonNote>{{ t('audio.emptySearch') }}</IonNote>
    </div>
    <div v-else class="empty-state">
      <div class="empty-state__illustration">
        🎵
      </div>
      <p class="empty-state__title">
        {{ t('audio.empty') }}
      </p>
      <div class="empty-state__actions">
        <IonButton fill="outline" size="small" @click="triggerImport">
          <IonIcon :icon="cloudUploadOutline" />
          {{ t('audio.import') }}
        </IonButton>
        <IonButton fill="outline" size="small" @click="audioEditor.openCreate()">
          <IonIcon :icon="addOutline" />
          {{ t('contentEditor.createAudio') }}
        </IonButton>
      </div>
    </div>

    <!-- FAB add button -->
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton @click="audioEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

    <!-- Audio Editor Modal -->
    <ContentEditorModal
      :is-open="audioEditor.isOpen.value"
      :title="audioEditor.mode.value === 'create' ? t('contentEditor.createAudio') : t('contentEditor.editAudio')"
      :mode="audioEditor.mode.value"
      :is-saving="isSaving"
      :ai-enabled="aiSettings.isConfigured"
      :markdown="audioMarkdown"
      :monaco-filename="`${audioEditor.formData.value.name || 'audio'}.md`"
      @update:is-open="(v: boolean) => { if (!v) audioEditor.close() }"
      @update:markdown="audioMarkdown = $event"
      @sync-to-markdown="audioToMarkdown()"
      @sync-from-markdown="markdownToAudio($event)"
      @save="handleSaveAudio"
      @cancel="audioEditor.close()"
    >
      <template #form>
        <AudioEditorForm v-model="audioEditor.formData.value" />
      </template>
      <template #ai>
        <AiGeneratePanel content-type="audio" @apply="handleAiApplyAudio" />
      </template>
      <template #header-actions>
        <IonButton
          v-if="audioEditor.mode.value === 'edit'"
          fill="clear"
          color="danger"
          size="small"
          @click="handleDeleteAudio({ file: `adv/audio/${audioEditor.formData.value.name}.md`, name: audioEditor.formData.value.name })"
        >
          <IonIcon :icon="trashOutline" />
        </IonButton>
      </template>
    </ContentEditorModal>

    <!-- Hidden file input for audio import -->
    <input
      ref="fileInput"
      type="file"
      accept="audio/*"
      multiple
      style="display: none"
      @change="handleFileImport"
    >
  </LayoutPage>
</template>

<style scoped>
.card-list {
  display: flex;
  flex-direction: column;
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

.empty-state__actions {
  display: flex;
  gap: var(--adv-space-sm);
}
</style>
