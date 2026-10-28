<script setup lang="ts">
import type { CreativePartnerId } from '@advjs/agent'
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import CreativeTeamWorkspace from './CreativeTeamWorkspace.vue'

const props = defineProps<{ isOpen: boolean, initialPartner?: CreativePartnerId }>()
const emit = defineEmits<{ close: [], navigate: [] }>()
const { t } = useI18n()
const route = useRoute()
const closing = shallowRef(false)
watch(() => props.isOpen, (open) => {
  if (open)
    closing.value = false
})
watch(() => route.fullPath, () => {
  if (props.isOpen)
    emit('navigate')
})
</script>

<template>
  <IonModal :is-open="isOpen && !closing" :aria-label="t('creativeTeam.title')" @did-dismiss.stop="$emit('close')">
    <IonHeader>
      <IonToolbar>
        <IonTitle>
          {{ t('creativeTeam.title') }}
        </IonTitle><IonButtons slot="end">
          <IonButton @click="closing = true">
            {{ t('creativeTeam.backToEditor') }}
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent><CreativeTeamWorkspace :initial-partner="initialPartner" /></IonContent>
  </IonModal>
</template>
