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
  IonNote,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useManagedAuthoring } from '../composables/useManagedAuthoring'
import { showToast } from '../utils/toast'

const props = defineProps<{
  isOpen: boolean
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const managed = useManagedAuthoring()

const goal = ref('')
const rounds = ref(6)
const selectedIds = ref<Set<string>>(new Set())

const selectedCharacters = computed<AdvCharacter[]>(() =>
  props.characters.filter(c => selectedIds.value.has(c.id)),
)
const canRun = computed(() =>
  managed.canStartTask.value
  && !managed.isSubmitting.value
  && selectedCharacters.value.length >= 1
  && goal.value.trim().length > 0,
)

watch(() => props.isOpen, (open) => {
  if (open) {
    goal.value = ''
    rounds.value = 6
    selectedIds.value = new Set(props.characters.slice(0, 2).map(c => c.id))
    managed.clearError()
  }
})

function toggle(id: string) {
  if (selectedIds.value.has(id))
    selectedIds.value.delete(id)
  else
    selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value)
}

async function run() {
  if (!canRun.value)
    return
  try {
    await managed.start('simulate-roleplay', {
      characterIds: selectedCharacters.value.map(character => character.id),
      goal: goal.value.trim(),
      rounds: rounds.value,
    })
    await showToast(t('managedAuthoring.submitted'), 'success')
    emit('close')
  }
  catch {
    // Stable error is rendered below. Result remains available in the task rail.
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
        <IonTitle>{{ t('aiAuthoring.roleplay.modalTitle') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonList>
        <IonItem>
          <IonTextarea
            v-model="goal"
            :label="t('aiAuthoring.roleplay.goalLabel')"
            label-placement="stacked"
            :placeholder="t('aiAuthoring.roleplay.goalPlaceholder')"
            :auto-grow="true"
            :rows="2"
            :disabled="managed.isSubmitting.value"
          />
        </IonItem>
        <IonItem>
          <IonInput
            v-model.number="rounds"
            type="number"
            :label="t('aiAuthoring.roleplay.roundsLabel')"
            label-placement="stacked"
            :disabled="managed.isSubmitting.value"
            min="1"
            max="20"
          />
        </IonItem>
      </IonList>

      <div style="padding: var(--adv-space-md) var(--adv-space-md) 0;">
        <p style="font-size: var(--adv-font-body-sm); font-weight: 600; margin: 0;">
          {{ t('aiAuthoring.roleplay.selectCharacters') }}
          <span style="color: var(--adv-text-tertiary); font-weight: 400; margin-left: 4px;">
            ({{ selectedIds.size }}/{{ characters.length }})
          </span>
        </p>
      </div>

      <IonList v-if="characters.length > 0">
        <IonItem
          v-for="char in characters"
          :key="char.id"
          @click="toggle(char.id)"
        >
          <IonCheckbox
            :checked="selectedIds.has(char.id)"
            :disabled="managed.isSubmitting.value"
            @ion-change="toggle(char.id)"
          />
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonLabel slot="end">
            {{ char.name }}
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
          {{ t('aiAuthoring.roleplay.run') }}
        </IonButton>
        <IonNote v-if="managed.errorCode.value" color="danger" class="managed-note">
          {{ t(`managedAuthoring.errors.${managed.errorCode.value}`) }}
        </IonNote>
        <IonNote v-else class="managed-note">
          {{ t('managedAuthoring.nonPatchResult') }}
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
