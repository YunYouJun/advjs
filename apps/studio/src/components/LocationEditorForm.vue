<script setup lang="ts">
import type { LocationFormData } from '../utils/locationMd'
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
import TagsInput from './TagsInput.vue'

const { t } = useI18n()
const model = defineModel<LocationFormData>({ required: true })

function updateField<K extends keyof LocationFormData>(field: K, value: LocationFormData[K]) {
  model.value = { ...model.value, [field]: value }
}
</script>

<template>
  <div class="location-editor-form">
    <IonListHeader>
      <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonInput
          :value="model.id"
          :label="t('locations.locationId')"
          label-placement="stacked"
          :placeholder="t('locations.locationIdPlaceholder')"
          @ion-input="updateField('id', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonInput
          :value="model.name || ''"
          :label="t('locations.locationName')"
          label-placement="stacked"
          :placeholder="t('locations.locationNamePlaceholder')"
          @ion-input="updateField('name', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonSelect
          :value="model.type || 'other'"
          :label="t('locations.locationType')"
          label-placement="stacked"
          interface="popover"
          @ion-change="updateField('type', ($event.detail.value ?? 'other') as LocationFormData['type'])"
        >
          <IonSelectOption value="indoor">
            {{ t('locations.typeIndoor') }}
          </IonSelectOption>
          <IonSelectOption value="outdoor">
            {{ t('locations.typeOutdoor') }}
          </IonSelectOption>
          <IonSelectOption value="virtual">
            {{ t('locations.typeVirtual') }}
          </IonSelectOption>
          <IonSelectOption value="other">
            {{ t('locations.typeOther') }}
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
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('contentEditor.description') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonTextarea
          :value="model.description || ''"
          :label="t('locations.locationDescription')"
          label-placement="stacked"
          :placeholder="t('locations.locationDescriptionPlaceholder')"
          :auto-grow="true"
          :rows="3"
          @ion-input="updateField('description', ($event.detail.value ?? ''))"
        />
      </IonItem>
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('locations.linkedInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <div class="form-field">
          <IonLabel position="stacked">
            {{ t('locations.linkedScenes') }}
          </IonLabel>
          <TagsInput
            :model-value="model.linkedScenes || []"
            :placeholder="t('locations.linkedScenesPlaceholder')"
            @update:model-value="updateField('linkedScenes', $event)"
          />
        </div>
      </IonItem>
      <IonItem>
        <div class="form-field">
          <IonLabel position="stacked">
            {{ t('locations.linkedCharacters') }}
          </IonLabel>
          <TagsInput
            :model-value="model.linkedCharacters || []"
            :placeholder="t('locations.linkedCharactersPlaceholder')"
            @update:model-value="updateField('linkedCharacters', $event)"
          />
        </div>
      </IonItem>
    </IonList>
  </div>
</template>

<style scoped>
.location-editor-form {
  padding-bottom: var(--adv-space-lg);
}

.form-field {
  width: 100%;
  padding: var(--adv-space-sm) 0;
}
</style>
