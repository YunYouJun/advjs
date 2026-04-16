<script setup lang="ts">
import type { KnowledgeEntry } from '../../composables/useKnowledgeBase'
import {
  alertController,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, bookOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import KnowledgeEditorForm from '../../components/KnowledgeEditorForm.vue'
import { useKnowledgeBase } from '../../composables/useKnowledgeBase'
import { useProjectContent } from '../../composables/useProjectContent'
import { useSettingsStore } from '../../stores/useSettingsStore'
import { useStudioStore } from '../../stores/useStudioStore'
import { showToast } from '../../utils/toast'

const HEADING_LINE_RE = /^#[^\n]*\n\n?/

const { t } = useI18n()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const { getFs } = useProjectContent()
const knowledgeBase = useKnowledgeBase()

// --- Search ---
const searchQuery = ref('')
const selectedDomain = ref<string | null>(null)

const filteredEntries = computed(() => {
  let result = knowledgeBase.entries.value
  if (selectedDomain.value) {
    result = result.filter(e => e.domain === selectedDomain.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      e.title.toLowerCase().includes(q)
      || e.content.toLowerCase().includes(q)
      || e.domain.toLowerCase().includes(q),
    )
  }
  return result
})

// --- Refresh ---
async function handleRefresh(event: CustomEvent) {
  await reloadKnowledge()
  ;(event.target as HTMLIonRefresherElement).complete()
}

async function reloadKnowledge() {
  const project = studioStore.currentProject
  if (!project)
    return
  const fs = getFs()
  if (fs) {
    await knowledgeBase.loadFromFs(fs)
  }
  else if (project.source === 'cos' && project.cosPrefix) {
    await knowledgeBase.loadFromCos(settingsStore.cos, project.cosPrefix)
  }
}

// --- Editor modal ---
const showEditor = ref(false)
const editingEntry = ref<KnowledgeEntry | null>(null)
const editorData = ref({ title: '', domain: 'general', content: '' })

function handleCreate() {
  editingEntry.value = null
  editorData.value = { title: '', domain: 'general', content: '' }
  showEditor.value = true
}

function handleEdit(entry: KnowledgeEntry) {
  editingEntry.value = entry
  // Extract body content (remove # heading line)
  const bodyContent = entry.content.replace(HEADING_LINE_RE, '').trim()
  editorData.value = {
    title: entry.title,
    domain: entry.domain,
    content: bodyContent,
  }
  showEditor.value = true
}

function handleEditorUpdate(data: { title: string, domain: string, content: string }) {
  editorData.value = data
}

async function handleSave() {
  const fs = getFs()
  if (!fs)
    return

  const { title, domain, content } = editorData.value
  if (!title.trim()) {
    await showToast(t('knowledge.titleRequired'), 'warning')
    return
  }

  try {
    if (editingEntry.value) {
      // Update existing
      const fullContent = `# ${title}\n\n${content}`
      const updatedEntry: KnowledgeEntry = {
        ...editingEntry.value,
        title,
        domain,
        content: fullContent,
        sections: [], // Will be re-parsed on next load
      }
      await knowledgeBase.saveEntryFs(fs, updatedEntry)
    }
    else {
      // Create new
      await knowledgeBase.createEntryFs(fs, domain, title, content)
    }

    showEditor.value = false
    await showToast(t('contentEditor.saveSuccess'), 'success')
  }
  catch {
    await showToast(t('contentEditor.saveFailed', { error: '' }), 'danger')
  }
}

// --- Delete ---
async function handleDelete(entry: KnowledgeEntry) {
  const alert = await alertController.create({
    header: t('common.confirmDelete'),
    message: t('knowledge.confirmDelete', { name: entry.title }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.delete'),
        role: 'destructive',
        handler: async () => {
          const fs = getFs()
          if (!fs)
            return
          try {
            await knowledgeBase.deleteEntryFs(fs, entry.file)
            await showToast(t('common.deleted'), 'success')
          }
          catch {
            await showToast(t('contentEditor.saveFailed', { error: '' }), 'danger')
          }
        },
      },
    ],
  })
  await alert.present()
}
</script>

<template>
  <LayoutPage :title="t('knowledge.title')" show-back-button default-href="/tabs/workspace">
    <template #header-extra>
      <IonToolbar>
        <IonSearchbar
          v-model="searchQuery"
          :placeholder="t('knowledge.search')"
          :debounce="200"
        />
      </IonToolbar>
    </template>

    <IonRefresher slot="fixed" @ion-refresh="handleRefresh">
      <IonRefresherContent />
    </IonRefresher>

    <!-- Domain filter chips -->
    <div v-if="knowledgeBase.domains.value.length > 1" class="domain-chips">
      <IonChip
        :color="selectedDomain === null ? 'primary' : undefined"
        @click="selectedDomain = null"
      >
        {{ t('world.timelineFilterAll') }}
      </IonChip>
      <IonChip
        v-for="d in knowledgeBase.domains.value"
        :key="d"
        :color="selectedDomain === d ? 'primary' : undefined"
        @click="selectedDomain = d"
      >
        {{ d }}
      </IonChip>
    </div>

    <!-- Empty state -->
    <div v-if="!knowledgeBase.isLoading.value && filteredEntries.length === 0" class="empty-state">
      <IonIcon :icon="bookOutline" class="empty-state__icon" />
      <p class="empty-state__title">
        {{ searchQuery ? t('knowledge.emptySearch') : t('world.knowledgeEmpty') }}
      </p>
      <p class="empty-state__hint">
        {{ t('world.knowledgeEmptyHint') }}
      </p>
    </div>

    <!-- Entry list -->
    <IonList v-else>
      <IonItemSliding v-for="entry in filteredEntries" :key="entry.file">
        <IonItem button @click="handleEdit(entry)">
          <IonLabel>
            <h2>{{ entry.title }}</h2>
            <p>{{ entry.domain }} · {{ entry.sections.length }} {{ t('world.knowledgeSections', { count: entry.sections.length }) }}</p>
          </IonLabel>
          <IonNote slot="end">
            {{ Math.round(entry.content.length / 1000) }}k
          </IonNote>
        </IonItem>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonItemOptions side="end">
          <IonItemOption color="danger" @click="handleDelete(entry)">
            <IonIcon slot="icon-only" :icon="trashOutline" />
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    </IonList>

    <!-- FAB -->
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton @click="handleCreate">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

    <!-- Editor Modal -->
    <IonModal :is-open="showEditor" @did-dismiss="showEditor = false">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton @click="showEditor = false">
              {{ t('common.cancel') }}
            </IonButton>
          </IonButtons>
          <IonTitle>{{ editingEntry ? t('knowledge.edit') : t('knowledge.create') }}</IonTitle>
          <IonButtons slot="end">
            <IonButton :strong="true" @click="handleSave">
              {{ t('common.save') }}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <KnowledgeEditorForm
          :title="editorData.title"
          :domain="editorData.domain"
          :content="editorData.content"
          :domains="knowledgeBase.domains.value"
          :is-edit="!!editingEntry"
          @update="handleEditorUpdate"
        />
      </IonContent>
    </IonModal>
  </LayoutPage>
</template>

<style scoped>
.domain-chips {
  display: flex;
  gap: 4px;
  padding: var(--adv-space-sm) var(--adv-space-md);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--adv-space-2xl) var(--adv-space-lg);
  text-align: center;
}

.empty-state__icon {
  font-size: 48px;
  color: var(--adv-text-tertiary);
  margin-bottom: var(--adv-space-md);
}

.empty-state__title {
  font-size: var(--adv-font-body);
  color: var(--adv-text-secondary);
  margin: 0 0 var(--adv-space-xs);
}

.empty-state__hint {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}
</style>
