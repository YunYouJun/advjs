<script setup lang="ts">
import type { ChapterInfo } from '../../composables/useProjectContent'
import type { ChapterFormData } from '../../utils/chapterMd'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonNote,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AiGeneratePanel from '../../components/AiGeneratePanel.vue'
import ChapterCard from '../../components/ChapterCard.vue'
import ChapterEditorForm from '../../components/ChapterEditorForm.vue'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useRecentActivity } from '../../composables/useRecentActivity'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { stringifyChapterMd } from '../../utils/chapterMd'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const router = useRouter()
const aiSettings = useAiSettingsStore()

const { chapters, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()
const { trackAccess } = useRecentActivity()

// --- Search ---
const searchQuery = ref('')
const filteredChapters = computed<ChapterInfo[]>(() => {
  if (!searchQuery.value)
    return chapters.value
  const q = searchQuery.value.toLowerCase()
  return chapters.value.filter(c =>
    c.name.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q),
  )
})

// --- Chapter editor ---
const chapterEditor = useContentEditor<ChapterFormData>('chapter', () => ({
  filename: '',
  title: '',
  plotSummary: '',
  content: '',
}))
const chapterMarkdown = ref('')

function chapterToMarkdown() {
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
  const name = file.split('/').pop()?.replace('.adv.md', '') || file
  trackAccess({ id: file, label: name, type: 'chapter' })
  router.push(`/editor?file=${encodeURIComponent(file)}`)
}

function handlePlayChapter(file: string) {
  const name = file.split('/').pop()?.replace('.adv.md', '') || file
  trackAccess({ id: file, label: name, type: 'chapter' })
  router.push(`/tabs/play?file=${encodeURIComponent(file)}`)
}

// --- Save ---
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

// --- Delete ---
async function handleDeleteChapter(file: string) {
  const name = file.split('/').pop()?.replace('.adv.md', '') || file
  await deleteFile(file, t('chapters.confirmDelete', { name }))
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
        <IonTitle>{{ t('preview.chapters') }}</IonTitle>
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

      <!-- Chapter list -->
      <div v-if="filteredChapters.length > 0" class="card-list">
        <IonItemSliding v-for="chapter in filteredChapters" :key="chapter.file">
          <ChapterCard
            :chapter="chapter"
            @edit="handleEditChapter"
            @play="handlePlayChapter"
          />
          <IonItemOptions side="end">
            <IonItemOption color="danger" @click="handleDeleteChapter(chapter.file)">
              <IonIcon :icon="trashOutline" />
            </IonItemOption>
          </IonItemOptions>
        </IonItemSliding>
      </div>

      <!-- Empty state -->
      <div v-else-if="searchQuery" class="empty-state">
        <IonNote>{{ t('chapters.emptySearch') }}</IonNote>
      </div>
      <div v-else class="empty-state">
        <div class="empty-state__illustration">
          📖
        </div>
        <p class="empty-state__title">
          {{ t('preview.noChapters') }}
        </p>
        <IonButton fill="outline" size="small" @click="chapterEditor.openCreate()">
          <IonIcon :icon="addOutline" />
          {{ t('contentEditor.createChapter') }}
        </IonButton>
      </div>

      <!-- FAB add button -->
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="chapterEditor.openCreate()">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

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
    </IonContent>
  </IonPage>
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
</style>
