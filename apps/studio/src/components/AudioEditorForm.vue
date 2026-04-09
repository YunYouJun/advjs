<script setup lang="ts">
import type { AudioFormData } from '../utils/audioMd'
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import { useProjectContent } from '../composables/useProjectContent'
import TagsInput from './TagsInput.vue'

const { t } = useI18n()
const model = defineModel<AudioFormData>({ required: true })
const { scenes, chapters } = useProjectContent()

function updateField<K extends keyof AudioFormData>(field: K, value: AudioFormData[K]) {
  model.value = { ...model.value, [field]: value }
}

function updateLinkedScenes(event: CustomEvent) {
  updateField('linkedScenes', event.detail.value || [])
}

function updateLinkedChapters(event: CustomEvent) {
  updateField('linkedChapters', event.detail.value || [])
}
</script>

<template>
  <div class="audio-editor-form">
    <IonListHeader>
      <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonInput
          :value="model.name"
          :label="t('audio.name')"
          label-placement="stacked"
          :placeholder="t('audio.namePlaceholder')"
          @ion-input="updateField('name', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonTextarea
          :value="model.description || ''"
          :label="t('contentEditor.description')"
          label-placement="stacked"
          :placeholder="t('audio.descriptionPlaceholder')"
          :auto-grow="true"
          :rows="2"
          @ion-input="updateField('description', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <div class="form-field">
          <IonLabel position="stacked">
            {{ t('contentEditor.tags') }}
          </IonLabel>
          <TagsInput
            :model-value="model.tags || []"
            :placeholder="t('contentEditor.tagsPlaceholder')"
            @update:model-value="updateField('tags', $event)"
          />
        </div>
      </IonItem>
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('audio.linkedContent') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem v-if="scenes.length > 0">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonSelect
          :value="model.linkedScenes || []"
          :label="t('audio.linkedScenes')"
          label-placement="stacked"
          :multiple="true"
          interface="popover"
          @ion-change="updateLinkedScenes"
        >
          <IonSelectOption v-for="scene in scenes" :key="scene.file" :value="scene.id || scene.name">
            {{ scene.name }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>
      <IonItem v-if="chapters.length > 0">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonSelect
          :value="model.linkedChapters || []"
          :label="t('audio.linkedChapters')"
          label-placement="stacked"
          :multiple="true"
          interface="popover"
          @ion-change="updateLinkedChapters"
        >
          <IonSelectOption v-for="chapter in chapters" :key="chapter.file" :value="chapter.file">
            {{ chapter.name }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>
    </IonList>
  </div>
</template>

<style scoped>
.audio-editor-form {
  padding-bottom: var(--adv-space-lg);
}

.form-field {
  width: 100%;
  padding: var(--adv-space-sm) 0;
}
</style>
