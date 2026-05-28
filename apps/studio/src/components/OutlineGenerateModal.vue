<script setup lang="ts">
import type { AiAuthoringError } from '../utils/aiAuthoring/result'
import {
  IonButton,
  IonButtons,
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
import { useRouter } from 'vue-router'
import { useProjectContent } from '../composables/useProjectContent'
import { useProjectDescription } from '../composables/useProjectDescription'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { generateOutline } from '../utils/aiAuthoring/outlineGenerator'
import { notConfiguredError } from '../utils/aiAuthoring/result'
import { showToast } from '../utils/toast'
import AiErrorBanner from './AiErrorBanner.vue'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()
const aiSettings = useAiSettingsStore()
const { characters, getFs } = useProjectContent()
const { worldMd } = useProjectDescription()
const { loadFromFs } = useProjectDescription()

const hint = ref('')
const streaming = ref(false)
const draft = ref('')
const controller = ref<AbortController | null>(null)
const lastError = ref<AiAuthoringError | null>(null)

const hasResult = computed(() => draft.value.trim().length > 0)
const canGenerate = computed(() => aiSettings.isConfigured && !streaming.value)

watch(() => props.isOpen, (open) => {
  if (open) {
    hint.value = ''
    draft.value = ''
    streaming.value = false
    controller.value = null
    lastError.value = aiSettings.isConfigured ? null : notConfiguredError()
  }
})

async function runGenerate() {
  if (!canGenerate.value)
    return
  draft.value = ''
  lastError.value = null
  streaming.value = true
  controller.value = new AbortController()
  try {
    const result = await generateOutline({
      worldMd: worldMd.value,
      characters: characters.value,
      hint: hint.value,
      signal: controller.value.signal,
      onChunk: (delta) => {
        draft.value += delta
      },
    })
    if (result.error) {
      // aborted is shown as a soft note; other errors show banner
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

async function writeBack(openInEditor: boolean) {
  if (!hasResult.value)
    return
  try {
    const fs = getFs()
    if (!fs) {
      showToast(t('aiAuthoring.outline.failed'), 'danger')
      return
    }
    await fs.writeFile('adv/outline.md', draft.value)
    await loadFromFs(fs)
    showToast(t('aiAuthoring.outline.writeBackSuccess'), 'success')
    emit('close')
    if (openInEditor)
      router.push(`/editor?file=${encodeURIComponent('adv/outline.md')}`)
  }
  catch {
    showToast(t('aiAuthoring.outline.failed'), 'danger')
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
        <IonTitle>{{ t('aiAuthoring.outline.modalTitle') }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonList>
        <IonItem>
          <IonLabel>
            <h3>{{ t('aiAuthoring.outline.contextTitle') }}</h3>
            <p>
              {{ t('aiAuthoring.outline.contextWorld', { n: worldMd.length }) }}
              ·
              {{ t('aiAuthoring.outline.contextCharacters', { n: characters.length }) }}
            </p>
          </IonLabel>
        </IonItem>
        <IonItem>
          <IonTextarea
            v-model="hint"
            :label="t('aiAuthoring.outline.hintLabel')"
            label-placement="stacked"
            :placeholder="t('aiAuthoring.outline.hintPlaceholder')"
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
          {{ hasResult ? t('aiAuthoring.outline.regenerate') : t('aiAuthoring.outline.generate') }}
        </IonButton>
        <IonButton
          v-else
          expand="block"
          color="warning"
          @click="cancelGenerate"
        >
          <IonSpinner name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ t('aiAuthoring.outline.cancel') }}
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
            :label="t('aiAuthoring.outline.previewLabel')"
            label-placement="stacked"
            :readonly="true"
            :auto-grow="true"
            :rows="12"
            class="outline-preview"
          />
        </IonItem>
      </IonList>

      <div v-if="hasResult && !streaming" class="outline-actions">
        <IonButton expand="block" @click="writeBack(false)">
          {{ t('aiAuthoring.outline.writeBack') }}
        </IonButton>
        <IonButton expand="block" fill="outline" @click="writeBack(true)">
          {{ t('aiAuthoring.outline.openInEditor') }}
        </IonButton>
      </div>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.outline-actions {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.outline-preview {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
  font-size: 0.875em;
}
</style>
