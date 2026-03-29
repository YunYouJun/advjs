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
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useViewModeStore } from '../stores/useViewModeStore'
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

const showCreateForm = ref(false)

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

function getInitials(name: string): string {
  return name ? name.slice(0, 2) : '?'
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

        <!-- Custom character list -->
        <div v-if="viewModeStore.customCharacters.length > 0" class="spc-list">
          <div
            v-for="char in viewModeStore.customCharacters"
            :key="char.id"
            class="spc-item"
            :class="{ 'spc-item--selected': viewModeStore.playerCharacterId === char.id }"
            @click="selectCharacter(char.id)"
          >
            <div class="spc-item__avatar">
              {{ getInitials(char.name) }}
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

        <div v-else class="spc-empty">
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
