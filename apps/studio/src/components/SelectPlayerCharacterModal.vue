<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { addOutline, closeOutline, sparklesOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useProjectContent } from '../composables/useProjectContent'
import { useViewModeStore } from '../stores/useViewModeStore'
import { getCharacterInitials, getValidAvatarUrl } from '../utils/chatUtils'
import CharacterEditorForm from './CharacterEditorForm.vue'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()
const viewModeStore = useViewModeStore()
const { characters: projectCharacters } = useProjectContent()

const showCreateForm = ref(false)
const searchQuery = ref('')

const filteredProjectCharacters = computed(() => {
  if (!searchQuery.value)
    return projectCharacters.value
  const q = searchQuery.value.toLowerCase()
  return projectCharacters.value.filter(c =>
    c.name.toLowerCase().includes(q)
    || c.id.toLowerCase().includes(q)
    || c.tags?.some(tag => tag.toLowerCase().includes(q))
    || c.faction?.toLowerCase().includes(q),
  )
})

const filteredCustomCharacters = computed(() => {
  if (!searchQuery.value)
    return viewModeStore.customCharacters
  const q = searchQuery.value.toLowerCase()
  return viewModeStore.customCharacters.filter(c =>
    c.name.toLowerCase().includes(q)
    || c.id.toLowerCase().includes(q),
  )
})

function createEmptyCharacter(): AdvCharacter {
  return {
    id: '',
    name: '',
    personality: '',
    background: '',
    appearance: '',
  }
}

const newCharacter = ref<AdvCharacter>(createEmptyCharacter())

function selectCharacter(id: string) {
  viewModeStore.setPlayerCharacter(id)
  emit('close')
}

function stopPlaying() {
  viewModeStore.clearPlayerCharacter()
  emit('close')
}

async function removeCharacter(id: string) {
  viewModeStore.removeCustomCharacter(id)
  const toast = await toastController.create({
    message: t('common.ok'),
    duration: 1500,
    position: 'top',
  })
  await toast.present()
}

function startCreate() {
  newCharacter.value = createEmptyCharacter()
  showCreateForm.value = true
}

function goToAiCreate() {
  emit('close')
  router.push('/tabs/world/create-player')
}

function cancelCreate() {
  showCreateForm.value = false
}

async function saveNewCharacter() {
  const char = newCharacter.value
  if (!char.id || !char.name) {
    const toast = await toastController.create({
      message: t('contentEditor.validationError', { errors: 'ID, Name' }),
      duration: 2000,
      position: 'top',
      color: 'warning',
    })
    await toast.present()
    return
  }
  viewModeStore.addCustomCharacter({ ...char })
  viewModeStore.setPlayerCharacter(char.id)
  showCreateForm.value = false
  emit('close')
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    @did-dismiss="emit('close')"
  >
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton v-if="showCreateForm" @click="cancelCreate">
            {{ t('common.back') }}
          </IonButton>
          <IonButton v-else @click="emit('close')">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
            <IonIcon slot="icon-only" :icon="closeOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>{{ showCreateForm ? t('world.createCustomCharacter') : t('world.selectPlayerTitle') }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons v-if="showCreateForm" slot="end">
          <IonButton :disabled="!newCharacter.id || !newCharacter.name" @click="saveNewCharacter">
            {{ t('common.ok') }}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <!-- Create form view -->
      <template v-if="showCreateForm">
        <CharacterEditorForm v-model="newCharacter" />
      </template>

      <!-- Character list view -->
      <template v-else>
        <div class="spc-desc">
          {{ t('world.selectPlayerDesc') }}
        </div>

        <!-- Search bar -->
        <div v-if="projectCharacters.length > 0 || viewModeStore.customCharacters.length > 0" class="spc-search">
          <input
            v-model="searchQuery"
            type="text"
            class="spc-search__input"
            :placeholder="t('common.search')"
          >
        </div>

        <!-- Project characters section -->
        <div v-if="filteredProjectCharacters.length > 0" class="spc-section">
          <div class="spc-section__header">
            👥 {{ t('world.projectCharacters') }}
          </div>
          <div class="spc-list">
            <div
              v-for="char in filteredProjectCharacters"
              :key="char.id"
              class="spc-item"
              :class="{ 'spc-item--selected': viewModeStore.playerCharacterId === char.id }"
              @click="selectCharacter(char.id)"
            >
              <div class="spc-item__avatar">
                <img v-if="getValidAvatarUrl(char.avatar)" :src="getValidAvatarUrl(char.avatar)!" alt="" class="spc-item__avatar-img">
                <span v-else>{{ getCharacterInitials(char.name) }}</span>
              </div>
              <div class="spc-item__info">
                <div class="spc-item__name">
                  {{ char.name }}
                  <span v-if="char.faction" class="spc-item__faction">{{ char.faction }}</span>
                  <span v-if="viewModeStore.playerCharacterId === char.id" class="spc-item__check">✓</span>
                </div>
                <div v-if="char.personality || char.appearance" class="spc-item__desc">
                  {{ (char.personality || char.appearance || '').slice(0, 60) }}{{ (char.personality || char.appearance || '').length > 60 ? '...' : '' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Custom characters section -->
        <div v-if="filteredCustomCharacters.length > 0" class="spc-section">
          <div class="spc-section__header">
            🎭 {{ t('world.customCharacters') }}
          </div>
          <div class="spc-list">
            <div
              v-for="char in filteredCustomCharacters"
              :key="char.id"
              class="spc-item"
              :class="{ 'spc-item--selected': viewModeStore.playerCharacterId === char.id }"
              @click="selectCharacter(char.id)"
            >
              <div class="spc-item__avatar">
                {{ getCharacterInitials(char.name) }}
              </div>
              <div class="spc-item__info">
                <div class="spc-item__name">
                  {{ char.name }}
                  <span v-if="viewModeStore.playerCharacterId === char.id" class="spc-item__check">✓</span>
                </div>
                <div v-if="char.personality" class="spc-item__desc">
                  {{ char.personality.slice(0, 60) }}{{ char.personality.length > 60 ? '...' : '' }}
                </div>
              </div>
              <button
                class="spc-item__delete"
                :aria-label="t('common.clear')"
                @click.stop="removeCharacter(char.id)"
              >
                <IonIcon :icon="trashOutline" />
              </button>
            </div>
          </div>
        </div>

        <!-- Create new character buttons -->
        <div class="spc-section">
          <div class="spc-section__header">
            ✨ {{ t('world.createCustomCharacter') }}
          </div>

          <!-- AI Create button -->
          <button class="spc-create-btn spc-create-btn--ai" @click="goToAiCreate">
            <span class="spc-create-btn__icon">
              <IonIcon :icon="sparklesOutline" />
            </span>
            <span class="spc-create-btn__text">{{ t('world.aiCreateCharacter') }}</span>
          </button>

          <!-- Manual Create button -->
          <button class="spc-create-btn" @click="startCreate">
            <span class="spc-create-btn__icon">
              <IonIcon :icon="addOutline" />
            </span>
            <span class="spc-create-btn__text">{{ t('world.manualCreateCharacter') }}</span>
          </button>
        </div>

        <!-- Empty state when no characters at all and no search -->
        <div v-if="projectCharacters.length === 0 && viewModeStore.customCharacters.length === 0" class="spc-empty">
          <div class="spc-empty__icon">
            🎭
          </div>
          <p>{{ t('world.selectPlayerDesc') }}</p>
        </div>

        <!-- Stop playing button -->
        <div v-if="viewModeStore.playerCharacterId" class="spc-footer">
          <IonButton fill="outline" color="medium" expand="block" @click="stopPlaying">
            {{ t('world.stopPlaying') }}
          </IonButton>
        </div>
      </template>
    </IonContent>
  </IonModal>
</template>
