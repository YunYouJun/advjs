<script setup lang="ts">
import type { SceneFormData } from '../utils/sceneMd'
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
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectContent } from '../composables/useProjectContent'
import TagsInput from './TagsInput.vue'

const { t } = useI18n()
const model = defineModel<SceneFormData>({ required: true })
const { locations } = useProjectContent()
const inheritedHint = ref(false)

function updateField<K extends keyof SceneFormData>(field: K, value: SceneFormData[K]) {
  model.value = { ...model.value, [field]: value }
}

// Auto-fill imagePrompt from linked location's defaultImagePrompt
watch(() => model.value.linkedLocation, (locId) => {
  inheritedHint.value = false
  if (!locId || model.value.imagePrompt)
    return
  const loc = locations.value.find(l => (l.id || l.name) === locId)
  if (loc?.defaultImagePrompt) {
    model.value = { ...model.value, imagePrompt: loc.defaultImagePrompt }
    inheritedHint.value = true
  }
})
</script>

<template>
  <div class="scene-editor-form">
    <IonListHeader>
      <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonInput
          :value="model.id"
          :label="t('contentEditor.sceneId')"
          label-placement="stacked"
          :placeholder="t('contentEditor.sceneIdPlaceholder')"
          @ion-input="updateField('id', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonInput
          :value="model.name || ''"
          :label="t('contentEditor.sceneName')"
          label-placement="stacked"
          :placeholder="t('contentEditor.sceneNamePlaceholder')"
          @ion-input="updateField('name', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonSelect
          :value="model.type || 'image'"
          :label="t('contentEditor.sceneType')"
          label-placement="stacked"
          interface="popover"
          @ion-change="updateField('type', ($event.detail.value ?? 'image') as 'image' | 'model')"
        >
          <IonSelectOption value="image">
            {{ t('contentEditor.sceneTypeImage') }}
          </IonSelectOption>
          <IonSelectOption value="model">
            {{ t('contentEditor.sceneTypeModel') }}
          </IonSelectOption>
        </IonSelect>
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
      <IonItem v-if="locations.length > 0">
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonSelect
          :value="model.linkedLocation || ''"
          :label="t('contentEditor.linkedLocation')"
          label-placement="stacked"
          interface="popover"
          :placeholder="t('contentEditor.linkedLocationPlaceholder')"
          @ion-change="updateField('linkedLocation', ($event.detail.value ?? '') || undefined)"
        >
          <IonSelectOption value="">
            {{ t('common.none') }}
          </IonSelectOption>
          <IonSelectOption v-for="loc in locations" :key="loc.file" :value="loc.id || loc.name">
            {{ loc.name }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('contentEditor.description') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonTextarea
          :value="model.description || ''"
          :label="t('contentEditor.sceneDescription')"
          label-placement="stacked"
          :placeholder="t('contentEditor.sceneDescriptionPlaceholder')"
          :auto-grow="true"
          :rows="3"
          @ion-input="updateField('description', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonTextarea
          :value="model.imagePrompt || ''"
          :label="t('contentEditor.imagePrompt')"
          label-placement="stacked"
          :placeholder="t('contentEditor.imagePromptPlaceholder')"
          :auto-grow="true"
          :rows="3"
          @ion-input="updateField('imagePrompt', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <p v-if="inheritedHint" class="inherited-hint">
        {{ t('contentEditor.imagePromptInherited') }}
      </p>
    </IonList>
  </div>
</template>

<style scoped>
.scene-editor-form {
  padding-bottom: var(--adv-space-lg);
}

.form-field {
  width: 100%;
  padding: var(--adv-space-sm) 0;
}

.inherited-hint {
  padding: 0 var(--adv-space-lg);
  margin: calc(-1 * var(--adv-space-xs)) 0 var(--adv-space-sm);
  font-size: var(--adv-font-caption, 12px);
  color: var(--ion-color-success);
}
</style>
