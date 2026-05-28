<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { AiAuthoringError } from '../utils/aiAuthoring/result'
import type { ChapterFormData } from '../utils/chapterMd'
import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
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
import { useProjectContent } from '../composables/useProjectContent'
import { useProjectDescription } from '../composables/useProjectDescription'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { generateChapterDraft } from '../utils/aiAuthoring/chapterDraftGenerator'
import { notConfiguredError } from '../utils/aiAuthoring/result'
import { showToast } from '../utils/toast'
import AiErrorBanner from './AiErrorBanner.vue'

const props = defineProps<{
  isOpen: boolean
  chapter: ChapterFormData
}>()

const emit = defineEmits<{
  close: []
  apply: [{ mode: 'replace' | 'append', text: string }]
}>()

const { t } = useI18n()
const aiSettings = useAiSettingsStore()
const { characters } = useProjectContent()
const { worldMd, outlineMd } = useProjectDescription()

const hint = ref('')
const streaming = ref(false)
const draft = ref('')
const controller = ref<AbortController | null>(null)
const selectedIds = ref<Set<string>>(new Set())
const lastError = ref<AiAuthoringError | null>(null)

const selectedCharacters = computed<AdvCharacter[]>(() =>
  characters.value.filter(c => selectedIds.value.has(c.id)),
)

const hasResult = computed(() => draft.value.trim().length > 0)
const canGenerate = computed(() => aiSettings.isConfigured && !streaming.value)

watch(() => props.isOpen, (open) => {
  if (open) {
    hint.value = ''
    draft.value = ''
    streaming.value = false
    controller.value = null
    selectedIds.value = new Set(characters.value.map(c => c.id))
    lastError.value = aiSettings.isConfigured ? null : notConfiguredError()
  }
})

function toggleCharacter(id: string) {
  if (selectedIds.value.has(id))
    selectedIds.value.delete(id)
  else
    selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value)
}

async function runGenerate() {
  if (!canGenerate.value)
    return
  draft.value = ''
  lastError.value = null
  streaming.value = true
  controller.value = new AbortController()
  try {
    const result = await generateChapterDraft({
      worldMd: worldMd.value,
      outlineMd: outlineMd.value,
      chapter: props.chapter,
      characters: selectedCharacters.value,
      hint: hint.value,
      signal: controller.value.signal,
      onChunk: (delta) => {
        draft.value += delta
      },
    })
    if (result.error) {
      lastError.value = result.error
      draft.value = ''
      return
    }
    draft.value = result.data.text
  }
  finally {
    streaming.value = false
    controller.value = null
  }
}

function cancelGenerate() {
  controller.value?.abort()
}

function applyResult(mode: 'replace' | 'append') {
  if (!hasResult.value)
    return
  emit('apply', { mode, text: draft.value })
  emit('close')
}

async function copyResult() {
  if (!hasResult.value)
    return
  try {
    await navigator.clipboard.writeText(draft.value)
    showToast(t('aiAuthoring.chapter.copied'), 'success')
  }
  catch {
    showToast(t('aiAuthoring.chapter.failed'), 'danger')
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

      <div style="padding: var(--adv-space-md) var(--adv-space-md) 0;">
        <p style="font-size: var(--adv-font-body-sm); font-weight: 600; margin: 0;">
          {{ t('aiAuthoring.chapter.selectCharacters') }}
          <span style="color: var(--adv-text-tertiary); font-weight: 400; margin-left: 4px;">
            ({{ selectedIds.size }}/{{ characters.length }})
          </span>
        </p>
      </div>

      <IonList v-if="characters.length > 0">
        <IonItem
          v-for="char in characters"
          :key="char.id"
          @click="toggleCharacter(char.id)"
        >
          <IonCheckbox
            :checked="selectedIds.has(char.id)"
            @ion-change="toggleCharacter(char.id)"
          />
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonLabel slot="end">
            {{ char.name }}
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
            :disabled="streaming"
          />
        </IonItem>
      </IonList>

      <div style="padding: var(--adv-space-md);">
        <IonButton
          v-if="!streaming"
          :disabled="!canGenerate"
          expand="block"
          @click="runGenerate"
        >
          {{ hasResult ? t('aiAuthoring.chapter.regenerate') : t('aiAuthoring.chapter.generate') }}
        </IonButton>
        <IonButton
          v-else
          expand="block"
          color="warning"
          @click="cancelGenerate"
        >
          <IonSpinner name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ t('aiAuthoring.chapter.cancel') }}
        </IonButton>
      </div>

      <AiErrorBanner
        v-if="lastError"
        :error="lastError"
        @retry="runGenerate"
      />

      <IonList v-if="hasResult || streaming">
        <IonItem>
          <IonTextarea
            :value="draft"
            :label="t('aiAuthoring.chapter.previewLabel')"
            label-placement="stacked"
            :readonly="true"
            :auto-grow="true"
            :rows="14"
            class="draft-preview"
          />
        </IonItem>
      </IonList>

      <div v-if="hasResult && !streaming" class="draft-actions">
        <IonButton expand="block" @click="applyResult('replace')">
          {{ t('aiAuthoring.chapter.replace') }}
        </IonButton>
        <IonButton expand="block" fill="outline" @click="applyResult('append')">
          {{ t('aiAuthoring.chapter.append') }}
        </IonButton>
        <IonButton expand="block" fill="clear" @click="copyResult">
          {{ t('aiAuthoring.chapter.copy') }}
        </IonButton>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.draft-actions {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.draft-preview {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
  font-size: 0.875em;
}
</style>
