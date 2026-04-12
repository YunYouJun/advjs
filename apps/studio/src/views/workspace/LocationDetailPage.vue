<script setup lang="ts">
import type { LocationInfo, SceneInfo } from '../../composables/useProjectContent'
import type { LocationFormData } from '../../utils/locationMd'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  createOutline,
  imageOutline,
  locationOutline,
  peopleOutline,
} from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import LocationEditorForm from '../../components/LocationEditorForm.vue'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useCharacterStateStore } from '../../stores/useCharacterStateStore'
import { matchLocationByText } from '../../utils/locationMatch'
import { stringifyLocationMd } from '../../utils/locationMd'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { locations, scenes, characters, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const characterStateStore = useCharacterStateStore()

const locationId = computed(() => route.params.id as string)

const location = computed<LocationInfo | undefined>(() =>
  locations.value.find(l => l.id === locationId.value),
)

// Scenes linked to this location (via scene.linkedLocation)
const linkedScenes = computed<SceneInfo[]>(() => {
  if (!locationId.value)
    return []
  return scenes.value.filter(s => s.linkedLocation === locationId.value)
})

// Characters currently at this location (via dynamic state)
const charactersHere = computed(() => {
  if (!location.value)
    return []
  return characters.value.filter((char) => {
    const state = characterStateStore.getState(char.id)
    if (!state.location)
      return false
    const matched = matchLocationByText(state.location, [location.value!])
    return matched !== null
  })
})

// Characters explicitly linked in frontmatter
const linkedCharacters = computed(() => {
  const ids = location.value?.linkedCharacters || []
  if (ids.length === 0)
    return []
  return characters.value.filter(c => ids.includes(c.id) || ids.includes(c.name))
})

// --- Editor ---
const locationEditor = useContentEditor<LocationFormData>('location', () => ({
  id: '',
  name: '',
  type: 'other' as const,
  description: '',
  tags: [],
  linkedScenes: [],
  linkedCharacters: [],
}))

function openEdit() {
  if (!location.value)
    return
  const data: LocationFormData = {
    id: location.value.id || location.value.name,
    name: location.value.name,
    type: location.value.type || 'other',
    description: location.value.description,
    tags: location.value.tags,
    linkedScenes: location.value.linkedScenes,
    linkedCharacters: location.value.linkedCharacters,
  }
  locationEditor.openEdit(data)
}

async function handleSave() {
  const errors = locationEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }
  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }
  const result = await saveContent(dirHandle, 'location', locationEditor.mode.value, locationEditor.formData.value, locationEditor.originalId.value)
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

function goToScene(_scene: SceneInfo) {
  router.push(`/tabs/workspace/scenes`)
}

function goToCharacter(characterId: string) {
  router.push(`/tabs/world/chat/${characterId}`)
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/workspace/locations" />
        </IonButtons>
        <IonTitle>{{ location?.name || locationId }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton @click="openEdit">
            <IonIcon :icon="createOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div v-if="location" class="detail">
        <!-- Header -->
        <div class="detail__header">
          <IonIcon :icon="locationOutline" class="detail__icon" />
          <div>
            <h2 class="detail__name">
              {{ location.name }}
            </h2>
            <p v-if="location.type" class="detail__type">
              {{ t(`locations.type${location.type.charAt(0).toUpperCase()}${location.type.slice(1)}`) }}
            </p>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="location.tags?.length" class="detail__tags">
          <IonChip v-for="tag in location.tags" :key="tag" outline>
            {{ tag }}
          </IonChip>
        </div>

        <!-- Description -->
        <p v-if="location.description" class="detail__desc">
          {{ location.description }}
        </p>

        <!-- Linked Scenes -->
        <IonCard v-if="linkedScenes.length > 0">
          <IonCardHeader>
            <IonCardTitle class="detail__section-title">
              <IonIcon :icon="imageOutline" />
              {{ t('locations.detailLinkedScenes') }}
              <span class="detail__badge">{{ linkedScenes.length }}</span>
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div class="detail__list">
              <button v-for="scene in linkedScenes" :key="scene.file" class="detail__item" @click="goToScene(scene)">
                <span class="detail__item-name">{{ scene.name }}</span>
                <span v-if="scene.description" class="detail__item-desc">{{ scene.description }}</span>
              </button>
            </div>
          </IonCardContent>
        </IonCard>

        <!-- Characters Here (dynamic state) -->
        <IonCard v-if="charactersHere.length > 0">
          <IonCardHeader>
            <IonCardTitle class="detail__section-title">
              <IonIcon :icon="peopleOutline" />
              {{ t('locations.detailCharactersHere') }}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div class="detail__list">
              <button v-for="char in charactersHere" :key="char.id" class="detail__item" @click="goToCharacter(char.id)">
                <span class="detail__item-name">{{ char.name }}</span>
              </button>
            </div>
          </IonCardContent>
        </IonCard>

        <!-- Linked Characters (from frontmatter) -->
        <IonCard v-if="linkedCharacters.length > 0">
          <IonCardHeader>
            <IonCardTitle class="detail__section-title">
              <IonIcon :icon="peopleOutline" />
              {{ t('locations.detailLinkedCharacters') }}
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div class="detail__list">
              <button v-for="char in linkedCharacters" :key="char.id" class="detail__item" @click="goToCharacter(char.id)">
                <span class="detail__item-name">{{ char.name }}</span>
              </button>
            </div>
          </IonCardContent>
        </IonCard>

        <!-- Empty linked info -->
        <div v-if="linkedScenes.length === 0 && linkedCharacters.length === 0 && charactersHere.length === 0" class="detail__empty">
          <IonNote>{{ t('locations.detailNoLinks') }}</IonNote>
        </div>
      </div>

      <!-- Not found -->
      <div v-else class="detail__empty">
        <IonNote>{{ t('locations.detailNotFound') }}</IonNote>
      </div>

      <!-- Editor Modal -->
      <ContentEditorModal
        :is-open="locationEditor.isOpen.value"
        :title="t('locations.editLocation')"
        :mode="locationEditor.mode.value"
        :is-saving="isSaving"
        :markdown="stringifyLocationMd(locationEditor.formData.value)"
        :monaco-filename="`${locationEditor.formData.value.id || 'location'}.md`"
        @update:is-open="(v: boolean) => { if (!v) locationEditor.close() }"
        @save="handleSave"
        @cancel="locationEditor.close()"
      >
        <template #form>
          <LocationEditorForm v-model="locationEditor.formData.value" />
        </template>
      </ContentEditorModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.detail {
  padding: var(--adv-space-md);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.detail__header {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md);
}

.detail__icon {
  font-size: 36px;
  color: #10b981;
  flex-shrink: 0;
}

.detail__name {
  font-size: 20px;
  font-weight: 700;
  margin: 0;
  color: var(--adv-text-primary);
}

.detail__type {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-tertiary);
  margin: 2px 0 0;
}

.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail__desc {
  font-size: var(--adv-font-body);
  color: var(--adv-text-secondary);
  line-height: 1.7;
  margin: 0;
}

.detail__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--adv-font-body);
  font-weight: 600;
}

.detail__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  font-size: 11px;
  font-weight: 700;
}

.detail__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: border-color 0.15s ease;
}

.detail__item:hover {
  border-color: rgba(16, 185, 129, 0.3);
}

.detail__item:active {
  transform: scale(0.98);
}

.detail__item-name {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-primary);
}

.detail__item-desc {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-xl);
}
</style>
