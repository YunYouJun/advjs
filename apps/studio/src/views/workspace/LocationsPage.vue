<script setup lang="ts">
import type { LocationInfo } from '../../composables/useProjectContent'
import type { LocationFormData } from '../../utils/locationMd'
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
import { useRouter } from 'vue-router'
import AiGeneratePanel from '../../components/AiGeneratePanel.vue'
import DraftRestoreBanner from '../../components/common/DraftRestoreBanner.vue'
import LayoutPage from '../../components/common/LayoutPage.vue'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import LocationCard from '../../components/LocationCard.vue'
import LocationEditorForm from '../../components/LocationEditorForm.vue'
import LocationGraph from '../../components/LocationGraph.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useRecentActivity } from '../../composables/useRecentActivity'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { parseLocationMd, stringifyLocationMd } from '../../utils/locationMd'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const router = useRouter()
const aiSettings = useAiSettingsStore()

const { locations, scenes, characters, reload, getFs } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()
const { trackAccess } = useRecentActivity()

// --- Graph toggle ---
const showGraph = ref(false)

// --- Search ---
const searchQuery = ref('')
const filteredLocations = computed<LocationInfo[]>(() => {
  if (!searchQuery.value)
    return locations.value
  const q = searchQuery.value.toLowerCase()
  return locations.value.filter(l =>
    l.name.toLowerCase().includes(q)
    || l.description?.toLowerCase().includes(q)
    || l.tags?.some(tag => tag.toLowerCase().includes(q)),
  )
})

// --- Location editor ---
const locationEditor = useContentEditor<LocationFormData>('location', () => ({
  id: '',
  name: '',
  type: 'other' as const,
  description: '',
  tags: [],
  linkedScenes: [],
  linkedCharacters: [],
}))
const locationMarkdown = ref('')

function locationToMarkdown() {
  locationMarkdown.value = stringifyLocationMd(locationEditor.formData.value)
}

function markdownToLocation(md: string) {
  locationMarkdown.value = md
  try {
    const parsed = parseLocationMd(md)
    locationEditor.formData.value = parsed
  }
  catch {
    // keep formData unchanged on parse failure
  }
}

function handleAiApplyLocation(md: string) {
  markdownToLocation(md)
}

function handleViewLocation(location: LocationInfo) {
  trackAccess({ id: location.file, label: location.name, type: 'location', action: 'view' })
  router.push(`/tabs/workspace/locations/${encodeURIComponent(location.id || location.name)}`)
}

// --- Save ---
async function handleSaveLocation() {
  const errors = locationEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const fs = getFs()
  if (!fs) {
    await showToast(t('contentEditor.saveFailed', { error: 'No file system' }), 'danger')
    return
  }

  const result = await saveContent(fs, 'location', locationEditor.mode.value, locationEditor.formData.value, locationEditor.originalId.value)
  if (result.success) {
    await showToast(t('contentEditor.saveSuccess'))
    locationEditor.onSaved()
    locationEditor.close()
    await reload()
  }
  else {
    await showToast(t('contentEditor.saveFailed', { error: result.error }), 'danger')
  }
}

// --- Delete ---
async function handleDeleteLocation(location: LocationFormData) {
  const filePath = `adv/locations/${location.id}.md`
  const deleted = await deleteFile(filePath, t('locations.confirmDelete', { name: location.name || location.id }))
  if (deleted) {
    locationEditor.close()
  }
}
</script>

<template>
  <LayoutPage :title="t('locations.title')" show-back-button default-href="/tabs/workspace">
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
      v-if="locationEditor.hasDraft.value"
      :message="t('contentEditor.draftFound', { type: t('locations.createLocation') })"
      @restore="locationEditor.restoreDraft()"
      @discard="locationEditor.clearDraft()"
    />

    <!-- Location graph toggle -->
    <div v-if="locations.length >= 2" class="graph-toggle">
      <IonButton
        fill="clear"
        size="small"
        @click="showGraph = !showGraph"
      >
        {{ showGraph ? '📋' : '📊' }}
        {{ showGraph ? t('locations.title') : t('locations.locationGraph') }}
      </IonButton>
    </div>

    <!-- Location graph (collapsible) -->
    <Transition name="fade">
      <LocationGraph
        v-if="showGraph && locations.length >= 2"
        :locations="locations"
        :scenes="scenes"
        :characters="characters"
        @select-location="(id: string) => router.push(`/tabs/workspace/locations/${encodeURIComponent(id)}`)"
      />
    </Transition>

    <!-- Location grid -->
    <div v-if="filteredLocations.length > 0" class="card-grid">
      <IonItemSliding v-for="location in filteredLocations" :key="location.file">
        <LocationCard
          :location="location"
          @click="handleViewLocation(location)"
        />
        <IonItemOptions side="end">
          <IonItemOption color="danger" @click="handleDeleteLocation({ id: location.id || location.name, name: location.name, type: location.type || 'other', description: location.description, tags: location.tags, linkedScenes: location.linkedScenes, linkedCharacters: location.linkedCharacters })">
            <IonIcon :icon="trashOutline" />
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    </div>

    <!-- Empty state -->
    <div v-else-if="searchQuery" class="empty-state">
      <IonNote>{{ t('locations.emptySearch') }}</IonNote>
    </div>
    <div v-else class="empty-state">
      <div class="empty-state__illustration">
        📍
      </div>
      <p class="empty-state__title">
        {{ t('workspace.noLocations') }}
      </p>
      <IonButton fill="outline" size="small" @click="locationEditor.openCreate()">
        <IonIcon :icon="addOutline" />
        {{ t('locations.createLocation') }}
      </IonButton>
    </div>

    <!-- FAB add button -->
    <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton @click="locationEditor.openCreate()">
        <IonIcon :icon="addOutline" />
      </IonFabButton>
    </IonFab>

    <!-- Location Editor Modal -->
    <ContentEditorModal
      :is-open="locationEditor.isOpen.value"
      :title="locationEditor.mode.value === 'create' ? t('locations.createLocation') : t('locations.editLocation')"
      :mode="locationEditor.mode.value"
      :is-saving="isSaving"
      :ai-enabled="aiSettings.isConfigured"
      :markdown="locationMarkdown"
      :monaco-filename="`${locationEditor.formData.value.id || 'location'}.md`"
      @update:is-open="(v: boolean) => { if (!v) locationEditor.close() }"
      @update:markdown="locationMarkdown = $event"
      @sync-to-markdown="locationToMarkdown()"
      @sync-from-markdown="markdownToLocation($event)"
      @save="handleSaveLocation"
      @cancel="locationEditor.close()"
    >
      <template #form>
        <LocationEditorForm v-model="locationEditor.formData.value" />
      </template>
      <template #ai>
        <AiGeneratePanel content-type="location" @apply="handleAiApplyLocation" />
      </template>
      <template #header-actions>
        <IonButton
          v-if="locationEditor.mode.value === 'edit'"
          fill="clear"
          color="danger"
          size="small"
          @click="handleDeleteLocation(locationEditor.formData.value)"
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
