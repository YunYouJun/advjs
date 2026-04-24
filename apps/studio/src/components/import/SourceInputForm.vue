<!--
  Source material input form for Step 2 of the import wizard.

  Decoupled responsibilities:
    • collects { sourceType, sourceText, projectName }
    • shows live token estimate + segment count (useful preview for users)
    • file drag / upload support → reads text via FileReader

  Does NOT call parseSource itself — that's the page's job — to keep this
  component reusable in contexts where you might want just the input UI
  without the pipeline hookup.
-->
<script setup lang="ts">
import type { SourceType } from '../../utils/sourceParser'
import {
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTextarea,
} from '@ionic/vue'
import { cloudUploadOutline, documentTextOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { estimateTokens } from '../../utils/tokenEstimate'

const props = defineProps<{
  modelValue: {
    sourceType: SourceType
    sourceText: string
    projectName: string
  }
}>()

const emit = defineEmits<{
  'update:modelValue': [value: {
    sourceType: SourceType
    sourceText: string
    projectName: string
  }]
}>()

const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)

// ----- Two-way bindings ------------------------------------------------------
// We debounce writes into the parent only when the user leaves a field — but
// for simplicity and responsiveness of the token counter we emit immediately.

function update(patch: Partial<typeof props.modelValue>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

// Local computed with getters/setters so template uses plain v-model
const sourceType = computed({
  get: () => props.modelValue.sourceType,
  set: (v: SourceType) => update({ sourceType: v }),
})
const sourceText = computed({
  get: () => props.modelValue.sourceText,
  set: (v: string) => update({ sourceText: v }),
})
const projectName = computed({
  get: () => props.modelValue.projectName,
  set: (v: string) => update({ projectName: v }),
})

// ----- Token / segment preview -----------------------------------------------
const tokensEstimate = computed(() => estimateTokens(sourceText.value))
// Rough segment estimate: ceil(tokens / 1000) — matches sourceChunk default.
const segmentsEstimate = computed(() => Math.max(1, Math.ceil(tokensEstimate.value / 1000)))

// ----- File upload handler ---------------------------------------------------
async function handleFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    const text = await file.text()
    update({ sourceText: text })
    // Auto-detect source type from extension if the user hasn't already picked one.
    if (file.name.endsWith('.md') || file.name.endsWith('.markdown'))
      update({ sourceType: 'markdown', sourceText: text })
  }
  finally {
    // Reset so selecting the same file twice re-triggers change.
    input.value = ''
  }
}
</script>

<template>
  <div class="source-input">
    <!-- Source type segment -->
    <IonItem lines="none" class="source-input__type">
      <IonLabel position="stacked">
        {{ t('importSource.sourceType') }}
      </IonLabel>
      <IonSegment v-model="sourceType" :value="sourceType">
        <IonSegmentButton value="text">
          <IonLabel>{{ t('importSource.sourceTypeText') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="markdown">
          <IonLabel>{{ t('importSource.sourceTypeMarkdown') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="chat-log">
          <IonLabel>{{ t('importSource.sourceTypeChatLog') }}</IonLabel>
        </IonSegmentButton>
      </IonSegment>
    </IonItem>

    <!-- Project name -->
    <IonItem>
      <IonLabel position="stacked">
        {{ t('importSource.projectName') }}
      </IonLabel>
      <IonInput
        v-model="projectName"
        :placeholder="t('importSource.projectNamePlaceholder')"
        clear-input
      />
    </IonItem>

    <!-- Source text -->
    <IonItem class="source-input__text-item">
      <IonLabel position="stacked">
        {{ t('importSource.sourceInput') }}
      </IonLabel>
      <IonTextarea
        v-model="sourceText"
        :placeholder="t('importSource.sourcePlaceholder')"
        auto-grow
        :rows="8"
        class="source-input__textarea"
      />
    </IonItem>

    <!-- Upload + stats row -->
    <div class="source-input__actions">
      <button class="source-input__upload" @click="fileInput?.click()">
        <IonIcon :icon="cloudUploadOutline" />
        <span>{{ t('importSource.uploadFile') }}</span>
      </button>
      <input
        ref="fileInput"
        type="file"
        accept=".txt,.md,.markdown,.log"
        class="source-input__file-input"
        @change="handleFileChange"
      >

      <span v-if="sourceText" class="source-input__stats">
        <IonIcon :icon="documentTextOutline" />
        <span>{{ t('importSource.tokensEstimated', { tokens: tokensEstimate.toLocaleString() }) }}</span>
        <span class="source-input__stats-sep">·</span>
        <span>{{ t('importSource.segments', { count: segmentsEstimate }) }}</span>
      </span>
    </div>

    <IonNote class="source-input__hint">
      {{ t('importSource.sourceInputHint') }}
    </IonNote>
  </div>
</template>

<style scoped>
.source-input {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md, 12px);
}

.source-input__type ion-segment {
  margin-top: 6px;
}

.source-input__text-item {
  --background: var(--adv-surface-card, var(--ion-background-color));
}

.source-input__textarea {
  font-size: 0.9rem;
  line-height: 1.6;
  min-height: 180px;
}

.source-input__actions {
  display: flex;
  align-items: center;
  gap: var(--adv-space-md, 12px);
  flex-wrap: wrap;
  padding: 0 var(--adv-space-sm, 8px);
}

.source-input__upload {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ion-color-primary) 10%, transparent);
  color: var(--ion-color-primary);
  border: 1px dashed color-mix(in srgb, var(--ion-color-primary) 40%, transparent);
  cursor: pointer;
  font-size: 0.85rem;
}
.source-input__upload:hover {
  background: color-mix(in srgb, var(--ion-color-primary) 18%, transparent);
}

.source-input__file-input {
  display: none;
}

.source-input__stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.8rem;
}

.source-input__stats-sep {
  opacity: 0.5;
}

.source-input__hint {
  font-size: 0.75rem;
  padding: 0 var(--adv-space-sm, 8px);
}
</style>
