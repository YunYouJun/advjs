<!--
  Source material input form for Step 2 of the import wizard.

  Decoupled responsibilities:
    • collects { sourceType, sourceText, projectName, sourceBlob? }
    • shows live token estimate + segment count (useful preview for users)
    • file drag / upload support → reads text via FileReader
    • PDF / Image / Audio modes with dedicated drop zones
    • URL mode with input field

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
import {
  cloudUploadOutline,
  documentTextOutline,
  imageOutline,
  micOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { estimateTokens } from '../../utils/tokenEstimate'

export interface SourceInputModel {
  sourceType: SourceType
  sourceText: string
  projectName: string
  sourceBlob?: Blob
}

const props = defineProps<{
  modelValue: SourceInputModel
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SourceInputModel]
}>()

const { t } = useI18n()

const PDF_EXT_RE = /\.pdf$/i
const FILE_EXT_RE = /\.\w+$/

const fileInput = ref<HTMLInputElement | null>(null)
const pdfFileInput = ref<HTMLInputElement | null>(null)
const imageFileInput = ref<HTMLInputElement | null>(null)
const audioFileInput = ref<HTMLInputElement | null>(null)

const pdfFileName = ref('')
const imagePreviewUrl = ref('')
const audioFileName = ref('')

// ----- Two-way bindings ------------------------------------------------------

function update(patch: Partial<SourceInputModel>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}

const sourceType = computed({
  get: () => props.modelValue.sourceType,
  set: (v: SourceType) => {
    // Clear blob when switching away from file-based types
    update({ sourceType: v, sourceBlob: undefined })
    pdfFileName.value = ''
    imagePreviewUrl.value = ''
    audioFileName.value = ''
  },
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
const isTextBasedSource = computed(() =>
  ['text', 'markdown', 'chat-log', 'url'].includes(sourceType.value),
)
const tokensEstimate = computed(() =>
  isTextBasedSource.value ? estimateTokens(sourceText.value) : 0,
)
const segmentsEstimate = computed(() => Math.max(1, Math.ceil(tokensEstimate.value / 1000)))

// ----- File upload handlers --------------------------------------------------
async function handleTextFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  try {
    const text = await file.text()
    update({ sourceText: text })
    if (file.name.endsWith('.md') || file.name.endsWith('.markdown'))
      update({ sourceType: 'markdown', sourceText: text })
  }
  finally {
    input.value = ''
  }
}

function handlePdfFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  pdfFileName.value = file.name
  update({
    sourceText: `[PDF: ${file.name}]`,
    sourceBlob: file,
  })
  if (!props.modelValue.projectName) {
    update({ projectName: file.name.replace(PDF_EXT_RE, '') })
  }
  input.value = ''
}

function handlePdfDrop(ev: DragEvent) {
  const file = ev.dataTransfer?.files[0]
  if (file?.type === 'application/pdf') {
    pdfFileName.value = file.name
    update({
      sourceText: `[PDF: ${file.name}]`,
      sourceBlob: file,
    })
    if (!props.modelValue.projectName)
      update({ projectName: file.name.replace(PDF_EXT_RE, '') })
  }
}

function handleImageFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  imagePreviewUrl.value = URL.createObjectURL(file)
  update({
    sourceText: `[Image: ${file.name}]`,
    sourceBlob: file,
  })
  if (!props.modelValue.projectName)
    update({ projectName: file.name.replace(FILE_EXT_RE, '') })
  input.value = ''
}

function handleImageDrop(ev: DragEvent) {
  const file = ev.dataTransfer?.files[0]
  if (file?.type.startsWith('image/')) {
    imagePreviewUrl.value = URL.createObjectURL(file)
    update({
      sourceText: `[Image: ${file.name}]`,
      sourceBlob: file,
    })
    if (!props.modelValue.projectName)
      update({ projectName: file.name.replace(FILE_EXT_RE, '') })
  }
}

function handleAudioFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return
  audioFileName.value = file.name
  update({
    sourceText: `[Audio: ${file.name}]`,
    sourceBlob: file,
  })
  if (!props.modelValue.projectName)
    update({ projectName: file.name.replace(FILE_EXT_RE, '') })
  input.value = ''
}

function handleAudioDrop(ev: DragEvent) {
  const file = ev.dataTransfer?.files[0]
  if (file?.type.startsWith('audio/')) {
    audioFileName.value = file.name
    update({
      sourceText: `[Audio: ${file.name}]`,
      sourceBlob: file,
    })
    if (!props.modelValue.projectName)
      update({ projectName: file.name.replace(FILE_EXT_RE, '') })
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
      <IonSegment v-model="sourceType" :value="sourceType" :scrollable="true">
        <IonSegmentButton value="text">
          <IonLabel>{{ t('importSource.sourceTypeText') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="markdown">
          <IonLabel>{{ t('importSource.sourceTypeMarkdown') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="chat-log">
          <IonLabel>{{ t('importSource.sourceTypeChatLog') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="pdf">
          <IonLabel>{{ t('importSource.sourceTypePdf') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="url">
          <IonLabel>{{ t('importSource.sourceTypeUrl') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="image">
          <IonLabel>{{ t('importSource.sourceTypeImage') }}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="audio">
          <IonLabel>{{ t('importSource.sourceTypeAudio') }}</IonLabel>
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

    <!-- PDF file upload -->
    <div v-if="sourceType === 'pdf'" class="source-input__drop-wrapper">
      <div
        class="source-input__drop-zone"
        @dragover.prevent
        @drop.prevent="handlePdfDrop"
        @click="pdfFileInput?.click()"
      >
        <IonIcon :icon="documentTextOutline" />
        <span>{{ pdfFileName || t('importSource.dropPdfHint') }}</span>
      </div>
      <input
        ref="pdfFileInput"
        type="file"
        accept=".pdf"
        class="source-input__file-input"
        @change="handlePdfFileChange"
      >
    </div>

    <!-- URL input -->
    <IonItem v-else-if="sourceType === 'url'">
      <IonLabel position="stacked">
        {{ t('importSource.urlInput') }}
      </IonLabel>
      <IonInput
        v-model="sourceText"
        type="url"
        :placeholder="t('importSource.urlPlaceholder')"
        clear-input
      />
    </IonItem>

    <!-- Image file upload -->
    <div v-else-if="sourceType === 'image'" class="source-input__drop-wrapper">
      <div
        class="source-input__drop-zone"
        @dragover.prevent
        @drop.prevent="handleImageDrop"
        @click="imageFileInput?.click()"
      >
        <img v-if="imagePreviewUrl" :src="imagePreviewUrl" class="source-input__image-preview">
        <template v-else>
          <IonIcon :icon="imageOutline" />
          <span>{{ t('importSource.dropImageHint') }}</span>
        </template>
      </div>
      <input
        ref="imageFileInput"
        type="file"
        accept="image/*"
        class="source-input__file-input"
        @change="handleImageFileChange"
      >
    </div>

    <!-- Audio file upload -->
    <div v-else-if="sourceType === 'audio'" class="source-input__drop-wrapper">
      <div
        class="source-input__drop-zone"
        @dragover.prevent
        @drop.prevent="handleAudioDrop"
        @click="audioFileInput?.click()"
      >
        <IonIcon :icon="micOutline" />
        <span>{{ audioFileName || t('importSource.dropAudioHint') }}</span>
      </div>
      <input
        ref="audioFileInput"
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
        class="source-input__file-input"
        @change="handleAudioFileChange"
      >
    </div>

    <!-- Source text (text / markdown / chat-log) -->
    <template v-else>
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
          @change="handleTextFileChange"
        >

        <span v-if="sourceText" class="source-input__stats">
          <IonIcon :icon="documentTextOutline" />
          <span>{{ t('importSource.tokensEstimated', { tokens: tokensEstimate.toLocaleString() }) }}</span>
          <span class="source-input__stats-sep">&middot;</span>
          <span>{{ t('importSource.segments', { count: segmentsEstimate }) }}</span>
        </span>
      </div>
    </template>

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
  border-radius: var(--adv-radius-sm);
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

/* Drop zones for PDF / Image / Audio */
.source-input__drop-wrapper {
  padding: 0 var(--adv-space-sm, 8px);
}

.source-input__drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--adv-space-sm, 8px);
  min-height: 160px;
  border: 2px dashed color-mix(in srgb, var(--ion-color-primary) 35%, transparent);
  border-radius: var(--adv-radius-md);
  background: color-mix(in srgb, var(--ion-color-primary) 5%, transparent);
  cursor: pointer;
  padding: var(--adv-space-lg, 24px);
  text-align: center;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.9rem;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.source-input__drop-zone:hover {
  border-color: var(--ion-color-primary);
  background: color-mix(in srgb, var(--ion-color-primary) 10%, transparent);
}

.source-input__drop-zone ion-icon {
  font-size: var(--adv-font-display);
  color: var(--ion-color-primary);
  opacity: 0.6;
}

.source-input__image-preview {
  max-width: 100%;
  max-height: 200px;
  border-radius: var(--adv-radius-sm);
  object-fit: contain;
}
</style>
