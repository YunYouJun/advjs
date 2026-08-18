<script setup lang="ts">
import type { ChapterFormData } from '../utils/chapterMd'
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonTextarea,
} from '@ionic/vue'
import { bulbOutline, chevronDownOutline, peopleOutline, shieldCheckmarkOutline, sparklesOutline } from 'ionicons/icons'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectContent } from '../composables/useProjectContent'
import { useManagedAgentStore } from '../stores/useManagedAgentStore'
import AiToolsPopover from './AiToolsPopover.vue'
import ChapterDraftModal from './ChapterDraftModal.vue'
import ConsistencyCheckModal from './ConsistencyCheckModal.vue'
import PlotSuggestionModal from './PlotSuggestionModal.vue'
import RoleplaySimulationModal from './RoleplaySimulationModal.vue'

const { t } = useI18n()
const managedStore = useManagedAgentStore()
const { isConfigured: managedAiAvailable } = storeToRefs(managedStore)
const { characters } = useProjectContent()
const model = defineModel<ChapterFormData>({ required: true })

const showDraftModal = ref(false)
const showPlotModal = ref(false)
const showRoleplayModal = ref(false)
const showConsistencyModal = ref(false)

function updateField<K extends keyof ChapterFormData>(field: K, value: ChapterFormData[K]) {
  model.value = { ...model.value, [field]: value }
}
</script>

<template>
  <div class="chapter-editor-form">
    <IonListHeader>
      <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonInput
          :value="model.filename"
          :label="t('contentEditor.chapterFilename')"
          label-placement="stacked"
          :placeholder="t('contentEditor.chapterFilenamePlaceholder')"
          @ion-input="updateField('filename', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonInput
          :value="model.title"
          :label="t('contentEditor.chapterTitle')"
          label-placement="stacked"
          :placeholder="t('contentEditor.chapterTitlePlaceholder')"
          @ion-input="updateField('title', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonTextarea
          :value="model.plotSummary || ''"
          :label="t('contentEditor.plotSummary')"
          label-placement="stacked"
          :placeholder="t('contentEditor.plotSummaryPlaceholder')"
          :auto-grow="true"
          :rows="2"
          @ion-input="updateField('plotSummary', ($event.detail.value ?? ''))"
        />
      </IonItem>
    </IonList>

    <IonListHeader class="chapter-content-header">
      <IonLabel>{{ t('contentEditor.chapterContent') }}</IonLabel>
      <!-- Mobile: collapsed popover (< 768px) -->
      <div v-if="managedAiAvailable" class="chapter-content-actions chapter-content-actions--mobile">
        <IonButton id="ai-tools-trigger" size="small" fill="clear">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="sparklesOutline" />
          {{ t('aiAuthoring.toolsMenu') }}
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="end" :icon="chevronDownOutline" />
        </IonButton>
        <AiToolsPopover
          trigger="ai-tools-trigger"
          @pick-plot="showPlotModal = true"
          @pick-roleplay="showRoleplayModal = true"
          @pick-draft="showDraftModal = true"
          @pick-consistency="showConsistencyModal = true"
        />
      </div>

      <!-- Desktop: 4 inline buttons (≥ 768px) -->
      <div v-if="managedAiAvailable" class="chapter-content-actions chapter-content-actions--desktop">
        <IonButton size="small" fill="clear" @click="showPlotModal = true">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="bulbOutline" />
          {{ t('aiAuthoring.plot.suggest') }}
        </IonButton>
        <IonButton size="small" fill="clear" @click="showRoleplayModal = true">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="peopleOutline" />
          {{ t('aiAuthoring.roleplay.run') }}
        </IonButton>
        <IonButton size="small" fill="clear" @click="showDraftModal = true">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="sparklesOutline" />
          {{ t('aiAuthoring.chapter.draft') }}
        </IonButton>
        <IonButton size="small" fill="clear" @click="showConsistencyModal = true">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="shieldCheckmarkOutline" />
          {{ t('aiAuthoring.consistency.run') }}
        </IonButton>
      </div>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonTextarea
          :value="model.content"
          :label="t('contentEditor.advMdContent')"
          label-placement="stacked"
          :placeholder="t('contentEditor.advMdContentPlaceholder')"
          :auto-grow="true"
          :rows="10"
          class="chapter-content-textarea"
          @ion-input="updateField('content', ($event.detail.value ?? ''))"
        />
      </IonItem>
    </IonList>

    <ChapterDraftModal
      :is-open="showDraftModal"
      :chapter="model"
      @close="showDraftModal = false"
    />

    <PlotSuggestionModal
      :is-open="showPlotModal"
      :chapter="model"
      @close="showPlotModal = false"
    />

    <RoleplaySimulationModal
      :is-open="showRoleplayModal"
      :characters="characters"
      @close="showRoleplayModal = false"
    />

    <ConsistencyCheckModal
      :is-open="showConsistencyModal"
      :chapter="model"
      @close="showConsistencyModal = false"
    />
  </div>
</template>

<style scoped>
.chapter-editor-form {
  padding-bottom: var(--adv-space-lg);
}

.chapter-content-textarea {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
  font-size: 0.875em;
}

.chapter-content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chapter-content-actions {
  gap: var(--adv-space-xs);
  flex-wrap: wrap;
  justify-content: flex-end;
}

.chapter-content-actions--desktop {
  display: none;
}

.chapter-content-actions--mobile {
  display: flex;
}

@media (min-width: 768px) {
  .chapter-content-actions--desktop {
    display: flex;
  }

  .chapter-content-actions--mobile {
    display: none;
  }
}
</style>
