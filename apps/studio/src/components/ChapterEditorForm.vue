<script setup lang="ts">
import type { ChapterFormData } from '../utils/chapterMd'
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonTextarea,
} from '@ionic/vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const model = defineModel<ChapterFormData>({ required: true })

function updateField<K extends keyof ChapterFormData>(field: K, value: ChapterFormData[K]) {
  model.value = { ...model.value, [field]: value }
}
</script>

<template>
  <div class="chapter-editor-form">
    <IonListHeader>
      <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonInput
          :value="model.filename"
          :label="t('contentEditor.chapterFilename')"
          label-placement="stacked"
          :placeholder="t('contentEditor.chapterFilenamePlaceholder')"
          @ion-input="updateField('filename', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonInput
          :value="model.title"
          :label="t('contentEditor.chapterTitle')"
          label-placement="stacked"
          :placeholder="t('contentEditor.chapterTitlePlaceholder')"
          @ion-input="updateField('title', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonTextarea
          :value="model.plotSummary || ''"
          :label="t('contentEditor.plotSummary')"
          label-placement="stacked"
          :placeholder="t('contentEditor.plotSummaryPlaceholder')"
          :auto-grow="true"
          :rows="2"
          @ion-input="updateField('plotSummary', ($event.detail.value ?? ''))"
        />
      </IonItem>
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('contentEditor.chapterContent') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonTextarea
          :value="model.content"
          :label="t('contentEditor.advMdContent')"
          label-placement="stacked"
          :placeholder="t('contentEditor.advMdContentPlaceholder')"
          :auto-grow="true"
          :rows="10"
          class="chapter-content-textarea"
          @ion-input="updateField('content', ($event.detail.value ?? ''))"
        />
      </IonItem>
    </IonList>
  </div>
</template>

<style scoped>
.chapter-editor-form {
  padding-bottom: var(--adv-space-lg);
}

.chapter-content-textarea {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
  font-size: 0.875em;
}
</style>
