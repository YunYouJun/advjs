<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { AiAuthoringError } from '../utils/aiAuthoring/result'
import type { RoleplayLine } from '../utils/aiAuthoring/roleplaySimulator'
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
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectDescription } from '../composables/useProjectDescription'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { notConfiguredError } from '../utils/aiAuthoring/result'
import {
  simulateRoleplay,
  transcriptToAdvScript,
} from '../utils/aiAuthoring/roleplaySimulator'
import { showToast } from '../utils/toast'
import AiErrorBanner from './AiErrorBanner.vue'

const props = defineProps<{
  isOpen: boolean
  characters: AdvCharacter[]
}>()

const emit = defineEmits<{
  close: []
  export: [string]
}>()

const { t } = useI18n()
const aiSettings = useAiSettingsStore()
const { worldMd } = useProjectDescription()

const goal = ref('')
const rounds = ref(6)
const selectedIds = ref<Set<string>>(new Set())
const lines = ref<RoleplayLine[]>([])
const running = ref(false)
const controller = ref<AbortController | null>(null)
const lastError = ref<AiAuthoringError | null>(null)

const selectedCharacters = computed<AdvCharacter[]>(() =>
  props.characters.filter(c => selectedIds.value.has(c.id)),
)
const canRun = computed(() =>
  aiSettings.isConfigured
  && !running.value
  && selectedCharacters.value.length >= 1
  && goal.value.trim().length > 0,
)
const hasTranscript = computed(() => lines.value.length > 0)

watch(() => props.isOpen, (open) => {
  if (open) {
    goal.value = ''
    rounds.value = 6
    selectedIds.value = new Set(props.characters.slice(0, 2).map(c => c.id))
    lines.value = []
    running.value = false
    controller.value = null
    lastError.value = aiSettings.isConfigured ? null : notConfiguredError()
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
  lines.value = []
  lastError.value = null
  running.value = true
  controller.value = new AbortController()
  try {
    const result = await simulateRoleplay({
      characters: selectedCharacters.value,
      goal: goal.value.trim(),
      worldMd: worldMd.value,
      rounds: rounds.value,
      signal: controller.value.signal,
      onLine: (line) => {
        lines.value = [...lines.value, line]
      },
    })
    if (result.error)
      lastError.value = result.error
  }
  finally {
    running.value = false
    controller.value = null
  }
}

function cancelRun() {
  controller.value?.abort()
}

function exportAdvScript() {
  if (!hasTranscript.value)
    return
  emit('export', transcriptToAdvScript(lines.value))
  emit('close')
}

async function copyAdvScript() {
  if (!hasTranscript.value)
    return
  try {
    await navigator.clipboard.writeText(transcriptToAdvScript(lines.value))
    showToast(t('aiAuthoring.roleplay.copied'), 'success')
  }
  catch {
    showToast(t('aiAuthoring.roleplay.failed'), 'danger')
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
            :disabled="running"
          />
        </IonItem>
        <IonItem>
          <IonInput
            v-model.number="rounds"
            type="number"
            :label="t('aiAuthoring.roleplay.roundsLabel')"
            label-placement="stacked"
            :disabled="running"
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
            :disabled="running"
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
          v-if="!running"
          :disabled="!canRun"
          expand="block"
          @click="run"
        >
          {{ hasTranscript ? t('aiAuthoring.roleplay.rerun') : t('aiAuthoring.roleplay.run') }}
        </IonButton>
        <IonButton
          v-else
          expand="block"
          color="warning"
          @click="cancelRun"
        >
          <IonSpinner name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ t('aiAuthoring.roleplay.cancel') }}
        </IonButton>
      </div>

      <AiErrorBanner
        v-if="lastError"
        :error="lastError"
        @retry="run"
      />

      <IonList v-if="lines.length">
        <IonItem v-for="(line, i) in lines" :key="i">
          <IonLabel class="ion-text-wrap">
            <h3>{{ line.speakerName }} <span class="speaker-id">@{{ line.speakerId }}</span></h3>
            <p>{{ line.content }}</p>
          </IonLabel>
        </IonItem>
      </IonList>

      <div v-if="hasTranscript && !running" class="roleplay-actions">
        <IonButton expand="block" @click="exportAdvScript">
          {{ t('aiAuthoring.roleplay.appendToChapter') }}
        </IonButton>
        <IonButton expand="block" fill="outline" @click="copyAdvScript">
          {{ t('aiAuthoring.roleplay.copy') }}
        </IonButton>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.roleplay-actions {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.speaker-id {
  color: var(--adv-text-tertiary);
  font-weight: 400;
  font-size: 0.85em;
}
</style>
