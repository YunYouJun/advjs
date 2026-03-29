<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useGroupChatStore } from '../stores/useGroupChatStore'

const props = defineProps<{
  isOpen: boolean
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()
const groupChatStore = useGroupChatStore()

const roomName = ref('')
const selectedIds = ref<Set<string>>(new Set())

const canCreate = computed(() => selectedIds.value.size >= 2)
const maxParticipants = 6

// Reset when modal opens
watch(() => props.isOpen, (open) => {
  if (open) {
    roomName.value = ''
    selectedIds.value = new Set()
  }
})

function toggleCharacter(id: string) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  }
  else if (selectedIds.value.size < maxParticipants) {
    selectedIds.value.add(id)
  }
  // Force reactivity
  selectedIds.value = new Set(selectedIds.value)
}

function handleCreate() {
  if (!canCreate.value)
    return

  const ids = Array.from(selectedIds.value)
  const name = roomName.value.trim() || generateDefaultName(ids)
  const roomId = groupChatStore.createRoom(name, ids)

  emit('close')
  router.push(`/tabs/world/group/${roomId}`)
}

function generateDefaultName(ids: string[]): string {
  const names = ids
    .map(id => props.characters.find(c => c.id === id)?.name || id)
    .slice(0, 3)
  const suffix = ids.length > 3 ? ` +${ids.length - 3}` : ''
  return names.join('、') + suffix
}
</script>

<template>
  <IonModal :is-open="isOpen" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton @click="emit('close')">
            {{ t('common.cancel') }}
          </IonButton>
        </IonButtons>
        <IonTitle>{{ t('world.createGroupChat') }}</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="end">
          <IonButton :disabled="!canCreate" :strong="true" @click="handleCreate">
            {{ t('common.ok') }}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonList>
        <IonItem>
          <IonInput
            v-model="roomName"
            :label="t('world.groupChatName')"
            label-placement="stacked"
            :placeholder="t('world.groupChatNamePlaceholder')"
          />
        </IonItem>
      </IonList>

      <div style="padding: 8px 16px;">
        <p style="font-size: 13px; font-weight: 600; color: var(--adv-text-secondary);">
          {{ t('world.selectCharacters') }}
        </p>
        <p v-if="!canCreate && selectedIds.size > 0" style="font-size: 11px; color: var(--adv-text-tertiary);">
          {{ t('world.minParticipants') }}
        </p>
      </div>

      <IonList>
        <IonItem v-for="char in characters" :key="char.id" @click="toggleCharacter(char.id)">
          <IonCheckbox
            :checked="selectedIds.has(char.id)"
            :disabled="!selectedIds.has(char.id) && selectedIds.size >= maxParticipants"
            @ion-change="toggleCharacter(char.id)"
          />
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonLabel slot="end">
            {{ char.name }}
          </IonLabel>
        </IonItem>
      </IonList>
    </IonContent>
  </IonModal>
</template>
