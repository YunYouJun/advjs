<script setup lang="ts">
import type { PlotSuggestion } from '../utils/aiAuthoring/plotSuggester'
import type { AiAuthoringError } from '../utils/aiAuthoring/result'
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
import { useWorldEventStore } from '../stores/useWorldEventStore'
import { suggestPlot } from '../utils/aiAuthoring/plotSuggester'
import { notConfiguredError } from '../utils/aiAuthoring/result'
import AiErrorBanner from './AiErrorBanner.vue'

const props = defineProps<{
  isOpen: boolean
  chapter: ChapterFormData
}>()

const emit = defineEmits<{
  close: []
  pick: [PlotSuggestion]
}>()

const { t } = useI18n()
const aiSettings = useAiSettingsStore()
const { characters } = useProjectContent()
const { worldMd } = useProjectDescription()
const worldEventStore = useWorldEventStore()

const hint = ref('')
const loading = ref(false)
const suggestions = ref<PlotSuggestion[]>([])
const lastError = ref<AiAuthoringError | null>(null)

const canRun = computed(() => aiSettings.isConfigured && !loading.value)
const recentEvents = computed(() =>
  worldEventStore.getRecentEvents(5).map((e: { date: string, period: string, summary: string }) =>
    `[${e.date} ${e.period}] ${e.summary}`,
  ),
)

watch(() => props.isOpen, (open) => {
  if (open) {
    hint.value = ''
    suggestions.value = []
    loading.value = false
    lastError.value = aiSettings.isConfigured ? null : notConfiguredError()
  }
})

async function run() {
  if (!canRun.value)
    return
  suggestions.value = []
  lastError.value = null
  loading.value = true
  try {
    const result = await suggestPlot({
      chapter: props.chapter,
      characters: characters.value,
      worldMd: worldMd.value,
      recentEvents: recentEvents.value,
      hint: hint.value,
    })
    if (result.error) {
      lastError.value = result.error
      return
    }
    suggestions.value = result.data
  }
  finally {
    loading.value = false
  }
}

function pick(s: PlotSuggestion) {
  emit('pick', s)
  emit('close')
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
        <IonTitle>{{ t('aiAuthoring.plot.modalTitle') }}</IonTitle>
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
        <IonItem>
          <IonTextarea
            v-model="hint"
            :label="t('aiAuthoring.plot.hintLabel')"
            label-placement="stacked"
            :placeholder="t('aiAuthoring.plot.hintPlaceholder')"
            :auto-grow="true"
            :rows="2"
            :disabled="loading"
          />
        </IonItem>
      </IonList>

      <div style="padding: var(--adv-space-md);">
        <IonButton
          :disabled="!canRun"
          expand="block"
          @click="run"
        >
          <IonSpinner v-if="loading" name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ suggestions.length ? t('aiAuthoring.plot.regenerate') : t('aiAuthoring.plot.generate') }}
        </IonButton>
      </div>

      <AiErrorBanner
        v-if="lastError"
        :error="lastError"
        @retry="run"
      />

      <IonList v-if="suggestions.length">
        <IonItem
          v-for="(s, i) in suggestions"
          :key="i"
          button
          @click="pick(s)"
        >
          <IonLabel class="ion-text-wrap">
            <h3>{{ i + 1 }}. {{ s.label }}</h3>
            <p>{{ s.synopsis }}</p>
            <p v-if="s.hook" class="plot-hook">
              <strong>{{ t('aiAuthoring.plot.hookPrefix') }}</strong>{{ s.hook }}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.plot-hook {
  margin-top: var(--adv-space-xs);
  color: var(--adv-text-secondary);
  font-size: var(--adv-font-caption);
}
</style>
