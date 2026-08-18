<script setup lang="ts">
import type { ChapterFormData } from '../utils/chapterMd'
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
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toManagedChapterPath } from '../agent/capabilities'
import { useManagedAuthoring } from '../composables/useManagedAuthoring'
import { useProjectContent } from '../composables/useProjectContent'
import { showToast } from '../utils/toast'

const props = defineProps<{
  isOpen: boolean
  chapter: ChapterFormData
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { characters } = useProjectContent()
const managed = useManagedAuthoring()

const hint = ref('')
const canGenerate = computed(() => managed.canStartTask.value && !managed.isSubmitting.value)

watch(() => props.isOpen, (open) => {
  if (open) {
    hint.value = ''
    managed.clearError()
  }
})

async function runGenerate() {
  if (!canGenerate.value)
    return
  try {
    await managed.start('generate-chapter-draft', {
      chapterPath: toManagedChapterPath(props.chapter.filename),
      ...(hint.value.trim() ? { hint: hint.value.trim() } : {}),
    })
    await showToast(t('managedAuthoring.submitted'), 'success')
    emit('close')
  }
  catch {
    // Stable error is rendered below. Cancellation remains available in the task rail.
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
            {{ t('common.cancel') }}
          </IonButton>
        </IonButtons>
        <IonTitle>{{ t('aiAuthoring.chapter.modalTitle') }}</IonTitle>
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

      <IonList v-if="characters.length > 0">
        <IonItem>
          <IonLabel class="ion-text-wrap">
            <h3>{{ t('aiAuthoring.chapter.selectCharacters') }}</h3>
            <p>{{ t('managedAuthoring.savedCharacters', { count: characters.length }) }}</p>
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList>
        <IonItem>
          <IonTextarea
            v-model="hint"
            :label="t('aiAuthoring.chapter.hintLabel')"
            label-placement="stacked"
            :placeholder="t('aiAuthoring.chapter.hintPlaceholder')"
            :auto-grow="true"
            :rows="2"
            :disabled="managed.isSubmitting.value"
          />
        </IonItem>
      </IonList>

      <div style="padding: var(--adv-space-md);">
        <IonButton
          :disabled="!canGenerate"
          expand="block"
          @click="runGenerate"
        >
          <IonSpinner v-if="managed.isSubmitting.value" name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ t('aiAuthoring.chapter.generate') }}
        </IonButton>
        <IonNote v-if="managed.errorCode.value" color="danger" class="managed-note">
          {{ t(`managedAuthoring.errors.${managed.errorCode.value}`) }}
        </IonNote>
        <IonNote v-else class="managed-note">
          {{ t('managedAuthoring.savedBaseline') }}
        </IonNote>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.managed-note {
  display: block;
  margin-top: var(--adv-space-sm);
  line-height: 1.5;
}
</style>
