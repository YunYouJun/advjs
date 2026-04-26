<!--
  ImportSourcePage — Phase M10 source-to-project wizard shell.

  The shell's single responsibility is wiring: it combines
    • useProjectImport (pure state machine)
    • TemplatePickerCard (Step 1)
    • SourceInputForm     (Step 2)
    • ProgressTree        (left pane of Step 3)
    • GenerationPreviewPane (right pane of Step 3)
    • ImportCompletionActions (after done)
  and talks to the studioStore + fs layer to persist on confirm.

  Responsive layout:
    • Desktop (≥ 768px): side-by-side progress + preview
    • Mobile (< 768px): stacked — progress pinned, preview scrolls below

  UX standard (see docs/studio/ai-contest-2026.md §4.1):
    1. First character name visible within < 10s of clicking Generate
    2. Progress tree shows 4 steps + per-step children as they arrive
    3. Cancel button always present while generating
    4. Errors are inline, with retry — prior state is kept intact
    5. Preview renders markdown (MarkdownMessage), not raw JSON
    6. Completion action cards guide next step (Play / Edit / Export)
    7. Draft mode relabels the confirm button
-->
<script setup lang="ts">
import type { SourceType } from '../../utils/sourceParser'
import {
  alertController,
  IonButton,
  IonIcon,
  IonProgressBar,
  IonSpinner,
} from '@ionic/vue'
import {
  alertCircleOutline,
  arrowBackOutline,
  arrowForwardOutline,
  closeCircleOutline,
  sparklesOutline,
} from 'ionicons/icons'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import LayoutPage from '../../components/common/LayoutPage.vue'
import GenerationPreviewPane from '../../components/import/GenerationPreviewPane.vue'
import ImportCompletionActions from '../../components/import/ImportCompletionActions.vue'
import ProgressTree from '../../components/import/ProgressTree.vue'
import SourceInputForm from '../../components/import/SourceInputForm.vue'
import TemplatePickerCard from '../../components/import/TemplatePickerCard.vue'
import { useProjectImport } from '../../composables/useProjectImport'
import { useResponsive } from '../../composables/useResponsive'
import { useAiSettingsStore } from '../../stores/useAiSettingsStore'
import { useStudioStore } from '../../stores/useStudioStore'
import { openProjectDirectory } from '../../utils/fs'
import { BrowserFsAdapter } from '../../utils/fs/BrowserFsAdapter'
import { toSlug } from '../../utils/slug'
import { listTemplates, suggestTemplateFor } from '../../utils/templates/loadTemplate'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const router = useRouter()
const studioStore = useStudioStore()
const aiSettings = useAiSettingsStore()
const { isDesktop } = useResponsive()

// ---------- Composable (state machine) --------------------------------------
const imp = useProjectImport()

// ---------- Step tracking ----------------------------------------------------
// 1=pick-template, 2=provide-source, 3=generate-preview
const currentWizardStep = ref<1 | 2 | 3>(1)

// ---------- Step 1: template ------------------------------------------------
const templates = listTemplates()
// "life-story" is the main contest attraction — highlight it as recommended.
const RECOMMENDED_TEMPLATE_ID = 'life-story'
const selectedTemplateId = ref<string | null>(RECOMMENDED_TEMPLATE_ID)
const selectedTemplate = computed(
  () => templates.find(t => t.id === selectedTemplateId.value) ?? null,
)

// ---------- Step 2: source input ---------------------------------------------
const sourceInput = ref<{
  sourceType: SourceType
  sourceText: string
  projectName: string
  sourceBlob?: Blob
}>({
  sourceType: 'text',
  sourceText: '',
  projectName: '',
})

const canAdvanceToStep2 = computed(() => !!selectedTemplate.value)
const canAdvanceToStep3 = computed(
  () => {
    if (!selectedTemplate.value || !sourceInput.value.projectName.trim())
      return false
    // Blob-based sources (PDF, image, audio) only need a blob
    if (['pdf', 'image', 'audio'].includes(sourceInput.value.sourceType))
      return !!sourceInput.value.sourceBlob
    // Text-based sources need sufficient text
    return sourceInput.value.sourceText.trim().length > 20
  },
)

// ---------- Derived: slug + AI readiness -------------------------------------
const projectSlug = computed(() => toSlug(sourceInput.value.projectName))
const isAiReady = computed(() => aiSettings.isConfigured)

// ---------- Error state ------------------------------------------------------
// Local message for validation errors (vs imp.error which is pipeline-scoped).
const localError = ref<string | null>(null)

function clearLocalError() {
  localError.value = null
}

/**
 * Map a pipeline error into a user-actionable sentence. Handles the four
 * common failure modes (auth / rate-limit / network / parse) with specific
 * remediation advice instead of leaking the raw LLM stack trace to judges.
 */
const classifiedError = computed<string | null>(() => {
  const raw = imp.error.value
  if (!raw)
    return null
  // Unknown errors come through as plain message strings. We can't inspect
  // their type, so pattern-match against the message.
  const msg = raw.message
  if (msg.includes('JSON invalid') || msg.includes('did not return valid'))
    return t('importSource.errorKind.parse')
  if (msg.includes('Invalid API key') || msg.includes('API key'))
    return t('importSource.errorKind.auth')
  if (msg.includes('Rate limit'))
    return t('importSource.errorKind.rate_limit')
  if (msg.includes('not found') || msg.includes('Model not found'))
    return t('importSource.errorKind.not_found')
  if (msg.toLowerCase().includes('timed out') || msg.toLowerCase().includes('timeout'))
    return t('importSource.errorKind.timeout')
  if (msg.toLowerCase().includes('network') || msg.includes('fetch'))
    return t('importSource.errorKind.network')
  if (msg.includes('HTTP '))
    return t('importSource.errorKind.api_error', { message: msg })
  return t('importSource.errorKind.unknown', { message: msg })
})

// ---------- Step transitions ------------------------------------------------
function goBack() {
  clearLocalError()
  if (currentWizardStep.value > 1)
    currentWizardStep.value = (currentWizardStep.value - 1) as 1 | 2 | 3
  else
    router.back()
}

function advance() {
  clearLocalError()
  if (currentWizardStep.value === 1) {
    if (!selectedTemplate.value) {
      localError.value = t('importSource.errorNoTemplate')
      return
    }
    currentWizardStep.value = 2
  }
  else if (currentWizardStep.value === 2) {
    if (!sourceInput.value.sourceText.trim()) {
      localError.value = t('importSource.errorEmptySource')
      return
    }
    if (!sourceInput.value.projectName.trim()) {
      localError.value = t('importSource.errorNoProjectName')
      return
    }
    currentWizardStep.value = 3
    // Kick off generation immediately on entering step 3.
    void runGeneration()
  }
}

// ---------- Generation -------------------------------------------------------
async function runGeneration() {
  if (!isAiReady.value) {
    localError.value = t('importSource.errorNoAiConfig')
    return
  }
  if (!selectedTemplate.value)
    return

  try {
    // Build AI config for source types that need it (image OCR, audio ASR)
    const needsAiForParse = ['image', 'audio'].includes(sourceInput.value.sourceType)
    const aiConfigForParse = needsAiForParse
      ? {
          baseURL: aiSettings.effectiveBaseURL,
          apiKey: aiSettings.config.apiKey,
          model: sourceInput.value.sourceType === 'audio'
            ? (aiSettings.config.asrModel || 'whisper-1')
            : aiSettings.effectiveModel,
        }
      : undefined

    // Step 2a: parse source
    const source = await imp.startParse({
      type: sourceInput.value.sourceType,
      content: sourceInput.value.sourceBlob || sourceInput.value.sourceText,
      aiConfig: aiConfigForParse,
    })

    // Step 2b: run pipeline
    await imp.startGenerate({
      source,
      template: selectedTemplate.value,
      projectName: sourceInput.value.projectName,
      projectSlug: projectSlug.value,
    })
  }
  catch (err: any) {
    // AbortError is already handled (status → idle), not a user-facing error.
    // Any other failure is already reflected in imp.error via the state
    // machine; we intentionally swallow here so the UI stays on Step 3 with
    // the inline error + retry button instead of bubbling an unhandled
    // rejection out of the component.
    if (err?.name !== 'AbortError') {
      // no-op — see above
    }
  }
}

function handleCancel() {
  imp.abort()
}

function handleRetry() {
  imp.reset()
  void runGeneration()
}

// ---------- Confirm write ----------------------------------------------------
const isConfirming = ref(false)

async function handleConfirm() {
  if (!imp.canConfirm.value)
    return

  isConfirming.value = true
  try {
    // 1. Ask the user for a parent directory to place the new project in.
    let parentDir: FileSystemDirectoryHandle
    try {
      parentDir = await openProjectDirectory()
    }
    catch (err: any) {
      // User cancelled the picker.
      if (err?.name === 'AbortError')
        return
      throw err
    }

    // 2. Create the child dir for this project (slug as folder name).
    //    If it already exists, warn the user and abort — we don't overwrite.
    let alreadyExists = false
    try {
      await parentDir.getDirectoryHandle(projectSlug.value)
      alreadyExists = true
    }
    catch (e: any) {
      if (e?.name !== 'NotFoundError')
        throw e
    }
    if (alreadyExists) {
      const alert = await alertController.create({
        header: t('importSource.errorProjectExists', { slug: projectSlug.value }),
        buttons: [t('common.ok')],
      })
      await alert.present()
      return
    }

    const projectDir = await parentDir.getDirectoryHandle(projectSlug.value, { create: true })
    const fs = new BrowserFsAdapter(projectDir)

    // 3. Write files through the composable.
    await imp.confirmWrite({ fs })

    // 4. Switch studio project so the user sees it immediately.
    await studioStore.switchProject({
      projectId: projectSlug.value,
      name: sourceInput.value.projectName,
      dirHandle: projectDir,
      source: 'local',
      lastOpened: Date.now(),
    })

    await showToast(t('importSource.writeSuccess'), 'success')
  }
  catch (err: any) {
    await showToast(t('importSource.errorWrite', { message: err?.message ?? String(err) }), 'danger')
  }
  finally {
    isConfirming.value = false
  }
}

// ---------- Completion actions ----------------------------------------------
function goPlay() {
  void router.push('/tabs/play')
}

function goEdit() {
  void router.push('/tabs/workspace')
}

async function goExport() {
  // Dynamic import — we already did the write, so the project lives in the
  // studio store; reuse the existing export flow.
  const { exportProject } = await import('../../composables/useProjectExport')
  const project = studioStore.currentProject
  if (!project?.dirHandle)
    return
  const fs = new BrowserFsAdapter(project.dirHandle)
  const blob = await exportProject(fs, project.name)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.projectId}.advpkg.zip`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- Progress tree view ---------------------------------------------
const progressNodes = computed(() => {
  const tree = imp.progressTree
  return [
    { ...tree.characters, label: t('importSource.stepCharacters') },
    { ...tree.chapters, label: t('importSource.stepChapters') },
    { ...tree.scenes, label: t('importSource.stepScenes') },
    { ...tree.knowledge, label: t('importSource.stepKnowledge') },
  ]
})

/**
 * Short caption rendered next to the spinner while generating — tells users
 * which step the model is working on, so they never stare at an ambiguous
 * spinner. Falls back to the generic "Generating…" string.
 */
const currentStepCaption = computed(() => {
  const step = imp.currentStep.value
  if (!step || step === 'done')
    return t('importSource.generating')
  const label = {
    characters: t('importSource.stepCharacters'),
    chapters: t('importSource.stepChapters'),
    scenes: t('importSource.stepScenes'),
    knowledge: t('importSource.stepKnowledge'),
  }[step]
  return `${label} · ${t('importSource.statusRunning')}`
})

// ---------- Auto-template-suggestion on source change -----------------------
// If the user hasn't manually picked a template, follow source-parser's hint.
watch(() => sourceInput.value.sourceType, (newType) => {
  if (!selectedTemplateId.value) {
    const suggested = suggestTemplateFor({ type: newType })
    if (suggested)
      selectedTemplateId.value = suggested.id
  }
})

// ---------- Cleanup ---------------------------------------------------------
onBeforeUnmount(() => {
  // Abort any in-flight generation if the user navigates away.
  if (imp.isBusy.value)
    imp.abort()
})

// ---------- a11y: announce step transitions ---------------------------------
const ariaLiveRegion = ref('')
watch(() => imp.currentStep.value, (step) => {
  if (!step)
    return
  const label = {
    characters: t('importSource.stepCharacters'),
    chapters: t('importSource.stepChapters'),
    scenes: t('importSource.stepScenes'),
    knowledge: t('importSource.stepKnowledge'),
    done: t('importSource.done'),
  }[step]
  ariaLiveRegion.value = `${label} — ${t('importSource.statusRunning')}`
})

// ---------- Kick off AI-not-configured prompt on first mount ----------------
onMounted(() => {
  if (!isAiReady.value)
    localError.value = t('importSource.errorNoAiConfig')
})
</script>

<template>
  <LayoutPage :title="t('importSource.title')" :subtitle="t('importSource.subtitle')" show-back-button default-href="/tabs/workspace">
    <!-- Step header (breadcrumbs) -->
    <header class="import-page__stepper" aria-label="wizard steps">
      <div
        v-for="step in [1, 2, 3] as const"
        :key="step"
        class="import-page__stepper-item"
        :class="{ 'is-active': step === currentWizardStep, 'is-done': step < currentWizardStep }"
      >
        <span class="import-page__stepper-number">{{ step }}</span>
        <span class="import-page__stepper-label">
          {{ step === 1 ? t('importSource.step1') : step === 2 ? t('importSource.step2') : t('importSource.step3') }}
        </span>
      </div>
    </header>

    <div v-if="localError" class="import-page__error">
      <IonIcon :icon="alertCircleOutline" />
      <span>{{ localError }}</span>
      <IonButton
        v-if="!isAiReady"
        size="small"
        fill="clear"
        @click="router.push('/tabs/me/settings/ai')"
      >
        {{ t('importSource.openAiSettings') }}
      </IonButton>
    </div>

    <!-- Screen-reader live region -->
    <div class="import-page__sr-only" role="status" aria-live="polite">
      {{ ariaLiveRegion }}
    </div>

    <!-- Step 1: Template picker -->
    <section v-if="currentWizardStep === 1" class="import-page__step">
      <h2 class="import-page__section-title">
        {{ t('importSource.pickTemplate') }}
      </h2>
      <p class="import-page__section-hint">
        {{ t('importSource.pickTemplateHint') }}
      </p>
      <TemplatePickerCard
        v-model="selectedTemplateId"
        :templates="templates"
        :recommended-id="RECOMMENDED_TEMPLATE_ID"
      />
    </section>

    <!-- Step 2: Source input -->
    <section v-else-if="currentWizardStep === 2" class="import-page__step">
      <h2 class="import-page__section-title">
        {{ t('importSource.step2') }}
      </h2>
      <SourceInputForm v-model="sourceInput" />
    </section>

    <!-- Step 3: Generate + preview -->
    <section v-else class="import-page__step import-page__step--generate">
      <div class="import-page__generate-layout" :class="{ 'is-desktop': isDesktop }">
        <!-- Progress tree -->
        <div class="import-page__progress">
          <ProgressTree
            :nodes="progressNodes"
            :title="t('importSource.progressTitle')"
            :can-retry="false"
          />
          <div v-if="imp.error.value" class="import-page__generate-error">
            <IonIcon :icon="alertCircleOutline" />
            <div class="import-page__generate-error-body">
              <div class="import-page__generate-error-title">
                {{ classifiedError }}
              </div>
              <div class="import-page__generate-error-hint">
                {{ t('importSource.errorRecoveryHint') }}
              </div>
            </div>
            <IonButton size="small" fill="solid" @click="handleRetry">
              {{ t('importSource.retry') }}
            </IonButton>
          </div>
          <div v-if="imp.isBusy.value" class="import-page__progress-bar">
            <IonProgressBar type="indeterminate" />
            <div class="import-page__progress-bar-footer">
              <IonSpinner name="crescent" />
              <span>{{ currentStepCaption }}</span>
              <IonButton size="small" fill="clear" @click="handleCancel">
                <IonIcon slot="start" :icon="closeCircleOutline" />
                {{ t('importSource.cancel') }}
              </IonButton>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div class="import-page__preview">
          <div v-if="imp.previewFiles.value.length > 0" class="import-page__preview-counter">
            <IonIcon :icon="sparklesOutline" />
            <span>{{ t('importSource.fileCount', { count: imp.previewFiles.value.length }) }}</span>
          </div>
          <GenerationPreviewPane :files="imp.previewFiles.value" auto-follow />
        </div>
      </div>

      <!-- Completion actions (after done) -->
      <ImportCompletionActions
        v-if="imp.status.value === 'done'"
        :stats="imp.stats.value"
        :draft-mode="imp.draftMode.value"
        :show-export="!!studioStore.currentProject?.dirHandle"
        @play="goPlay"
        @edit="goEdit"
        @export="goExport"
      />
    </section>

    <!-- Footer navigation -->
    <template #footer>
      <div class="import-page__footer">
        <IonButton fill="clear" @click="goBack">
          <IonIcon slot="start" :icon="arrowBackOutline" />
          {{ currentWizardStep === 1 ? t('common.back') : t('common.back') }}
        </IonButton>

        <div class="import-page__footer-right">
          <!-- Step 1 → 2 -->
          <IonButton
            v-if="currentWizardStep === 1"
            :disabled="!canAdvanceToStep2"
            @click="advance"
          >
            {{ t('common.next') }}
            <IonIcon slot="end" :icon="arrowForwardOutline" />
          </IonButton>

          <!-- Step 2 → 3 -->
          <IonButton
            v-else-if="currentWizardStep === 2"
            :disabled="!canAdvanceToStep3 || !isAiReady"
            @click="advance"
          >
            <IonIcon slot="start" :icon="sparklesOutline" />
            {{ t('importSource.generate') }}
          </IonButton>

          <!-- Step 3 confirm -->
          <IonButton
            v-else
            :disabled="!imp.canConfirm.value || isConfirming"
            color="primary"
            @click="handleConfirm"
          >
            <IonSpinner v-if="isConfirming" slot="start" name="crescent" />
            {{ imp.draftMode.value ? t('importSource.confirmDraft') : t('importSource.confirm') }}
          </IonButton>
        </div>
      </div>
    </template>
  </LayoutPage>
</template>

<style scoped>
/* ----- Stepper header ----- */
.import-page__stepper {
  display: flex;
  gap: var(--adv-space-sm, 8px);
  padding: var(--adv-space-md, 16px);
  border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  overflow-x: auto;
}
.import-page__stepper-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 16px;
  background: transparent;
  color: var(--ion-color-medium, #92949c);
  font-size: 0.85rem;
  flex-shrink: 0;
}
.import-page__stepper-item.is-active {
  background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
  color: var(--ion-color-primary);
  font-weight: 600;
}
.import-page__stepper-item.is-done {
  color: var(--ion-color-success, #2dd36f);
}
.import-page__stepper-number {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: currentColor;
  color: var(--ion-background-color);
  font-size: 0.7rem;
  font-weight: 700;
}

/* ----- Local validation error ----- */
.import-page__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: var(--adv-space-md, 16px);
  padding: 10px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--ion-color-warning, #ffc409) 15%, transparent);
  color: var(--ion-color-warning-shade, var(--ion-color-warning));
  font-size: 0.85rem;
}
.import-page__error ion-icon {
  font-size: 20px;
  flex-shrink: 0;
}

/* ----- Section layout ----- */
.import-page__step {
  padding: var(--adv-space-md, 16px);
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}
.import-page__step--generate {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md, 16px);
  padding-top: var(--adv-space-sm, 8px);
}

.import-page__section-title {
  margin: 0 0 6px;
  font-size: 1.15rem;
  font-weight: 600;
}
.import-page__section-hint {
  margin: 0 0 var(--adv-space-md, 16px);
  font-size: 0.85rem;
  color: var(--ion-color-medium, #92949c);
}

/* ----- Step 3: generation layout ----- */
.import-page__generate-layout {
  display: grid;
  gap: var(--adv-space-md, 16px);
  min-height: 400px;
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr;
}
.import-page__generate-layout.is-desktop {
  grid-template-columns: 300px 1fr;
  grid-template-rows: 1fr;
  min-height: 500px;
}

.import-page__progress {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm, 8px);
  min-height: 0;
}

.import-page__progress-bar {
  padding: var(--adv-space-sm, 8px) var(--adv-space-md, 14px);
  background: var(--adv-surface-card, var(--ion-background-color));
  border-radius: var(--adv-radius-md, 10px);
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
}
.import-page__progress-bar-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 0.8rem;
  color: var(--ion-color-medium, #92949c);
}
.import-page__progress-bar-footer ion-button {
  margin-left: auto;
}

.import-page__generate-error {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  background: color-mix(in srgb, var(--ion-color-danger, #eb445a) 12%, transparent);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--ion-color-danger, #eb445a);
}
.import-page__generate-error > ion-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}
.import-page__generate-error-body {
  flex: 1;
  min-width: 0;
}
.import-page__generate-error-title {
  font-weight: 500;
  line-height: 1.4;
}
.import-page__generate-error-hint {
  margin-top: 4px;
  font-size: 0.78rem;
  opacity: 0.8;
  color: var(--ion-text-color, inherit);
}
.import-page__generate-error ion-button {
  margin-left: auto;
  flex-shrink: 0;
}

.import-page__preview {
  min-height: 400px;
  position: relative;
}

.import-page__preview-counter {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--ion-color-primary) 90%, transparent);
  color: white;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
  animation: file-counter-pop 0.3s ease-out;
}
.import-page__preview-counter ion-icon {
  font-size: 13px;
}
@keyframes file-counter-pop {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ----- Footer ----- */
.import-page__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--adv-space-sm, 8px) var(--adv-space-md, 16px);
  padding-bottom: calc(var(--adv-space-sm, 8px) + env(safe-area-inset-bottom, 0px));
  background: var(--ion-background-color);
  border-top: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
}
.import-page__footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ----- Accessibility ----- */
.import-page__sr-only {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
</style>
