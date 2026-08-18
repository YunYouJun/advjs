<script setup lang="ts">
import type { ChapterFormData } from '../utils/chapterMd'
import { toManagedChapterPath } from '@advjs/agent'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useManagedAuthoring } from '../composables/useManagedAuthoring'
import { showToast } from '../utils/toast'

const props = defineProps<{
  isOpen: boolean
  chapter: ChapterFormData
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const managed = useManagedAuthoring()

const canRun = computed(() => managed.canStartTask.value && !managed.isSubmitting.value)

watch(() => props.isOpen, (open) => {
  if (open) {
    managed.clearError()
  }
})

async function run() {
  if (!canRun.value)
    return
  try {
    await managed.start('check-consistency', {
      chapterPath: toManagedChapterPath(props.chapter.filename),
    })
    await showToast(t('managedAuthoring.submitted'), 'success')
    emit('close')
  }
  catch {
    // Stable error is rendered below. Diagnostics open in the proposal review.
  }
}
</script>

<template>
  <IonModal :is-open="isOpen" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton @click="emit('close')">
            {{ t('common.close') }}
          </IonButton>
        </IonButtons>
        <IonTitle>{{ t('aiAuthoring.consistency.modalTitle') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonList>
        <IonItem>
          <IonLabel>
            <h3>{{ chapter.title || chapter.filename }}</h3>
            <p v-if="chapter.plotSummary">
              {{ chapter.plotSummary }}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>

      <div style="padding: var(--adv-space-md);">
        <IonButton
          :disabled="!canRun"
          expand="block"
          @click="run"
        >
          <IonSpinner v-if="managed.isSubmitting.value" name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ t('aiAuthoring.consistency.run') }}
        </IonButton>
        <IonNote v-if="managed.errorCode.value" color="danger" class="managed-note">
          {{ t(`managedAuthoring.errors.${managed.errorCode.value}`) }}
        </IonNote>
        <IonNote v-else class="managed-note">
          {{ t('managedAuthoring.consistencyResult') }}
        </IonNote>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.managed-note {
  display: block;
  margin-top: var(--adv-space-xs);
  line-height: 1.5;
}
</style>
