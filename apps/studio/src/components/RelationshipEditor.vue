<script setup lang="ts">
import type { AdvCharacter, AdvCharacterRelationship } from '@advjs/types'
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue'
import { addOutline, closeOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  /** Available characters in the project (for targetId selection) */
  characters?: AdvCharacter[]
  /** Current character being edited (to exclude from the list) */
  currentCharacterId?: string
}>()

const { t } = useI18n()
const model = defineModel<AdvCharacterRelationship[]>({ default: () => [] })

/** Characters available for selection (excluding the current one) */
const selectableCharacters = computed(() => {
  if (!props.characters)
    return []
  return props.characters.filter(c => c.id !== props.currentCharacterId)
})

function addRelationship() {
  model.value = [...model.value, { targetId: '', type: '', description: '' }]
}

function removeRelationship(index: number) {
  model.value = model.value.filter((_, i) => i !== index)
}

function updateField(index: number, field: keyof AdvCharacterRelationship, value: string) {
  const updated = [...model.value]
  updated[index] = { ...updated[index], [field]: value }
  model.value = updated
}

/** Get display label for a character id */
function getCharacterLabel(id: string): string {
  const char = props.characters?.find(c => c.id === id)
  return char ? `${char.name} (${char.id})` : id
}
</script>

<template>
  <div class="relationship-editor">
    <IonList v-if="model.length > 0" class="relationship-editor__list">
      <IonItem v-for="(rel, index) in model" :key="index" class="relationship-editor__item">
        <div class="relationship-editor__fields">
          <!-- targetId: select from character library or free-text input -->
          <template v-if="selectableCharacters.length > 0">
            <IonSelect
              :value="rel.targetId"
              :placeholder="t('contentEditor.relTargetId')"
              interface="popover"
              class="relationship-editor__field"
              @ion-change="updateField(index, 'targetId', ($event.detail.value ?? ''))"
            >
              <IonSelectOption
                v-for="char in selectableCharacters"
                :key="char.id"
                :value="char.id"
              >
                {{ char.name }} ({{ char.id }})
              </IonSelectOption>
              <!-- Keep a custom option if the current value isn't in the list -->
              <IonSelectOption
                v-if="rel.targetId && !selectableCharacters.some(c => c.id === rel.targetId)"
                :value="rel.targetId"
              >
                {{ getCharacterLabel(rel.targetId) }}
              </IonSelectOption>
            </IonSelect>
          </template>
          <IonInput
            v-else
            :value="rel.targetId"
            :placeholder="t('contentEditor.relTargetId')"
            class="relationship-editor__field"
            @ion-input="updateField(index, 'targetId', ($event.detail.value ?? ''))"
          />

          <IonInput
            :value="rel.type"
            :placeholder="t('contentEditor.relType')"
            class="relationship-editor__field"
            @ion-input="updateField(index, 'type', ($event.detail.value ?? ''))"
          />
          <IonInput
            :value="rel.description"
            :placeholder="t('contentEditor.relDescription')"
            class="relationship-editor__field"
            @ion-input="updateField(index, 'description', ($event.detail.value ?? ''))"
          />
        </div>
        <IonButton fill="clear" size="small" color="danger" @click="removeRelationship(index)">
          <IonIcon :icon="closeOutline" />
        </IonButton>
      </IonItem>
    </IonList>
    <IonButton fill="outline" size="small" @click="addRelationship">
      <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
      <IonIcon slot="start" :icon="addOutline" />
      <IonLabel>{{ t('contentEditor.addRelationship') }}</IonLabel>
    </IonButton>
  </div>
</template>

<style scoped>
.relationship-editor__list {
  padding: 0;
  margin-bottom: var(--adv-space-xs);
}

.relationship-editor__item {
  --padding-start: 0;
  --inner-padding-end: 0;
}

.relationship-editor__fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  padding: var(--adv-space-xs) 0;
}

.relationship-editor__field {
  font-size: var(--adv-font-body-sm);
}
</style>
