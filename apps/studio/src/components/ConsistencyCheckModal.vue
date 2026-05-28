<script setup lang="ts">
import type { ConsistencyIssue } from '../utils/aiAuthoring/consistencyChecker'
import type { AiAuthoringError } from '../utils/aiAuthoring/result'
import type { ChapterFormData } from '../utils/chapterMd'
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectContent } from '../composables/useProjectContent'
import { useProjectDescription } from '../composables/useProjectDescription'
import { useAiSettingsStore } from '../stores/useAiSettingsStore'
import { checkChapterConsistency } from '../utils/aiAuthoring/consistencyChecker'
import { notConfiguredError } from '../utils/aiAuthoring/result'
import AiErrorBanner from './AiErrorBanner.vue'

const props = defineProps<{
  isOpen: boolean
  chapter: ChapterFormData
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const aiSettings = useAiSettingsStore()
const { characters } = useProjectContent()
const { worldMd, outlineMd } = useProjectDescription()

const loading = ref(false)
const issues = ref<ConsistencyIssue[] | null>(null)
const lastError = ref<AiAuthoringError | null>(null)

const canRun = computed(() => aiSettings.isConfigured && !loading.value)
const hasResult = computed(() => issues.value !== null)
const passed = computed(() => hasResult.value && issues.value!.length === 0)

watch(() => props.isOpen, (open) => {
  if (open) {
    issues.value = null
    loading.value = false
    lastError.value = aiSettings.isConfigured ? null : notConfiguredError()
  }
})

async function run() {
  if (!canRun.value)
    return
  issues.value = null
  lastError.value = null
  loading.value = true
  try {
    const result = await checkChapterConsistency({
      chapter: props.chapter,
      characters: characters.value,
      worldMd: worldMd.value,
      outlineMd: outlineMd.value,
    })
    if (result.error) {
      lastError.value = result.error
      return
    }
    issues.value = result.data
  }
  finally {
    loading.value = false
  }
}

function severityColor(s: ConsistencyIssue['severity']): string {
  if (s === 'error')
    return 'danger'
  if (s === 'warn')
    return 'warning'
  return 'medium'
}
</script>

<template>
  <IonModal :is-open="isOpen" @did-dismiss="emit('close')">
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
        <IonButtons slot="start">
          <IonButton @click="emit('close')">
            {{ t('common.close') }}
          </IonButton>
        </IonButtons>
        <IonTitle>{{ t('aiAuthoring.consistency.modalTitle') }}</IonTitle>
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

      <div style="padding: var(--adv-space-md);">
        <IonButton
          :disabled="!canRun"
          expand="block"
          @click="run"
        >
          <IonSpinner v-if="loading" name="crescent" style="margin-right: 8px; width: 16px; height: 16px;" />
          {{ hasResult ? t('aiAuthoring.consistency.recheck') : t('aiAuthoring.consistency.run') }}
        </IonButton>
      </div>

      <AiErrorBanner
        v-if="lastError"
        :error="lastError"
        @retry="run"
      />

      <div v-if="passed" class="consistency-pass">
        <IonNote color="success">
          {{ t('aiAuthoring.consistency.passed') }}
        </IonNote>
      </div>

      <IonList v-else-if="hasResult && issues!.length">
        <IonItem v-for="(issue, i) in issues" :key="i">
          <IonLabel class="ion-text-wrap">
            <h3>
              <IonBadge :color="severityColor(issue.severity)" style="margin-right: 6px;">
                {{ t(`aiAuthoring.consistency.severity.${issue.severity}`) }}
              </IonBadge>
              {{ issue.title }}
            </h3>
            <p class="issue-kind">
              {{ t(`aiAuthoring.consistency.kind.${issue.kind}`) }}
              <span v-if="issue.characterId"> · @{{ issue.characterId }}</span>
            </p>
            <p>{{ issue.detail }}</p>
            <p v-if="issue.suggestion" class="issue-suggest">
              💡 {{ issue.suggestion }}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.consistency-pass {
  padding: var(--adv-space-md);
  text-align: center;
}

.issue-kind {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 2px 0;
}

.issue-suggest {
  margin-top: var(--adv-space-xs);
  color: var(--adv-text-secondary);
  font-style: italic;
}
</style>
