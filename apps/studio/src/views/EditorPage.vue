<script setup lang="ts">
import {
  IonBackButton,
  IonButton,
  IonIcon,
  IonNote,
  toastController,
} from '@ionic/vue'
import { createOutline, sparklesOutline } from 'ionicons/icons'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AiGeneratePanel from '../components/AiGeneratePanel.vue'
import LayoutPage from '../components/common/LayoutPage.vue'
import { useCloudSync } from '../composables/useCloudSync'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useStudioStore } from '../stores/useStudioStore'
import { downloadFromCloud } from '../utils/cloudSync'
import { downloadAsFile, readFileFromDir, writeFileToDir } from '../utils/fileAccess'

const BLOCK_LEVEL_RE = /^(?:## |[-*] |> |---|【)/

const { t, locale } = useI18n()
const route = useRoute()
const studioStore = useStudioStore()
const settingsStore = useSettingsStore()
const content = ref('')
const isSaving = ref(false)
const initialContent = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

/** Insert text at cursor position in textarea */
function insertAtCursor(text: string) {
  const el = textareaRef.value
  if (!el)
    return
  const start = el.selectionStart
  const end = el.selectionEnd
  const before = content.value.slice(0, start)
  const after = content.value.slice(end)

  // If inserting at start of line or empty, just insert
  // For block-level items (heading, list, quote, hr, scene), ensure we're at start of line
  const needsNewline = start > 0 && before.at(-1) !== '\n' && BLOCK_LEVEL_RE.test(text)
  const prefix = needsNewline ? '\n' : ''

  content.value = before + prefix + text + after

  // Restore cursor position after the inserted text
  const cursorPos = start + prefix.length + text.length
  requestAnimationFrame(() => {
    el.focus()
    el.setSelectionRange(cursorPos, cursorPos)
  })
}

const toolbarItems = [
  { label: 'H2', insert: '## ', title: 'editor.insertHeading' },
  { label: '@', insert: '@', title: 'editor.insertCharacter' },
  { label: '•', insert: '- ', title: 'editor.insertList' },
  { label: 'B', insert: '**', title: 'editor.insertBold' },
  { label: '>', insert: '> ', title: 'editor.insertQuote' },
  { label: '—', insert: '---\n', title: 'editor.insertDivider' },
  { label: '【】', insert: '【，，】', title: 'editor.insertScene' },
]

/** True when the file simply doesn't exist yet (not a read error) */
const fileNotFound = ref(false)

const {
  isDirty: cloudDirty,
  isSaving: cloudSaving,
  lastSaved: cloudLastSaved,
  autoSave: cloudAutoSave,
  saveNow: cloudSaveNow,
  isCosConfigured,
} = useCloudSync()

const filePath = computed(() => {
  return (route.query.file as string) || ''
})

const fileName = computed(() => {
  return filePath.value.split('/').pop() || 'Untitled'
})

/**
 * AI system prompt: locale-aware, scoped to file creation context.
 */
const aiSystemPrompt = computed(() => {
  return locale.value.startsWith('zh')
    ? `你是 ADV.JS 视觉小说游戏引擎的创作助手。请根据用户的描述生成对应的文件内容，使用 Markdown 格式输出。`
    : `You are a creative assistant for the ADV.JS visual novel engine. Generate file content based on the user's description in Markdown format.`
})

/**
 * User prefix: prepends file name context to every prompt.
 */
const aiUserPrefix = computed(() => `File: ${fileName.value}\n\n`)

/**
 * Whether auto-save should be active for current context.
 */
const isAutoSaveActive = computed(() => {
  const project = studioStore.currentProject
  if (!project)
    return false
  // Auto-save works for COS projects, or local projects when COS is configured
  return (project.source === 'cos' || isCosConfigured()) && settingsStore.cos.autoSave
})

/**
 * Save status indicator text.
 */
const saveStatusText = computed(() => {
  if (cloudSaving.value)
    return t('editor.saving')
  if (cloudLastSaved.value && !cloudDirty.value)
    return t('editor.autoSaved')
  if (cloudDirty.value)
    return t('editor.unsaved')
  return ''
})

/**
 * Save status color class.
 */
const saveStatusClass = computed(() => {
  if (cloudSaving.value)
    return 'save-status--saving'
  if (cloudLastSaved.value && !cloudDirty.value)
    return 'save-status--saved'
  if (cloudDirty.value)
    return 'save-status--unsaved'
  return ''
})

/** Detect whether an error means "file not found" */
function isNotFoundError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'NotFoundError')
    return true
  if (err instanceof Error && (err.message.includes('not found') || err.message.includes('NoSuchKey') || err.message.includes('404')))
    return true
  return false
}

onMounted(async () => {
  if (!filePath.value)
    return

  const project = studioStore.currentProject
  if (!project)
    return

  try {
    if (project.source === 'cos') {
      content.value = await downloadFromCloud(settingsStore.cos, filePath.value)
    }
    else if (project.dirHandle) {
      content.value = await readFileFromDir(project.dirHandle, filePath.value)
    }
    initialContent.value = content.value
  }
  catch (err) {
    if (isNotFoundError(err)) {
      fileNotFound.value = true
    }
    else {
      content.value = ''
      const toast = await toastController.create({
        message: t('editor.readFailed', { file: filePath.value }),
        duration: 2000,
        position: 'bottom',
        color: 'danger',
      })
      await toast.present()
    }
  }
})

// Watch content changes for auto-save
watch(content, (newVal) => {
  if (!isAutoSaveActive.value)
    return
  if (newVal === initialContent.value)
    return

  const project = studioStore.currentProject
  if (!project)
    return

  // For COS projects, auto-save directly to the file key
  if (project.source === 'cos' && filePath.value) {
    cloudAutoSave(filePath.value, newVal)
  }
  // For local projects with COS configured, auto-save to COS with project prefix
  else if (project.source === 'local' && isCosConfigured() && filePath.value) {
    const prefix = project.cosPrefix || `${project.name}/`
    cloudAutoSave(prefix + filePath.value, newVal)
  }
})

onUnmounted(() => {
  // Clean up is handled by the composable's watchers
})

/** Create an empty file and enter the editor */
function createEmpty() {
  content.value = ''
  initialContent.value = ''
  fileNotFound.value = false
}

/** Called when AiGeneratePanel emits its generated markdown */
function applyAiOutput(markdown: string) {
  content.value = markdown
  initialContent.value = ''
  fileNotFound.value = false
}

async function save() {
  isSaving.value = true

  try {
    const project = studioStore.currentProject

    if (project?.source === 'cos' && filePath.value) {
      // Save to COS (immediate, bypasses debounce)
      await cloudSaveNow(filePath.value, content.value)
      initialContent.value = content.value
      const toast = await toastController.create({
        message: t('editor.saved'),
        duration: 1000,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
    else if (project?.dirHandle && filePath.value) {
      // Write back to file system
      await writeFileToDir(project.dirHandle, filePath.value, content.value)
      initialContent.value = content.value

      // Also upload to COS if configured and autoSave is on
      if (isCosConfigured() && settingsStore.cos.autoSave) {
        const prefix = project.cosPrefix || `${project.name}/`
        await cloudSaveNow(prefix + filePath.value, content.value)
      }

      const toast = await toastController.create({
        message: t('editor.saved'),
        duration: 1000,
        position: 'top',
        color: 'success',
      })
      await toast.present()
    }
    else {
      // Fallback: download as file
      downloadAsFile(content.value, fileName.value)

      const toast = await toastController.create({
        message: t('editor.downloaded'),
        duration: 1500,
        position: 'top',
      })
      await toast.present()
    }
  }
  catch {
    const toast = await toastController.create({
      message: t('editor.saveFailed'),
      duration: 2000,
      position: 'top',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    isSaving.value = false
  }
}
</script>

<template>
  <LayoutPage :title="fileName">
    <template #start>
      <IonBackButton :text="t('editor.back')" default-href="/tabs/play" />
    </template>
    <template #end>
      <IonNote v-if="saveStatusText && !fileNotFound" class="save-status" :class="saveStatusClass">
        {{ saveStatusText }}
      </IonNote>
      <IonButton v-if="!fileNotFound" :disabled="isSaving" @click="save">
        {{ isSaving ? t('editor.saving') : t('editor.save') }}
      </IonButton>
    </template>

    <!-- File not found: creation guide -->
    <div v-if="fileNotFound" class="create-guide">
      <div class="create-guide__header">
        <div class="create-guide__icon">
          <IonIcon :icon="createOutline" />
        </div>
        <h2 class="create-guide__title">
          {{ t('editor.fileNotFound') }}
        </h2>
        <p class="create-guide__desc">
          {{ t('editor.fileNotFoundDesc') }}
        </p>
        <div class="create-guide__filename">
          {{ filePath }}
        </div>
      </div>

      <!-- Actions -->
      <div class="create-guide__actions">
        <IonButton expand="block" fill="outline" @click="createEmpty">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="createOutline" />
          {{ t('editor.createEmpty') }}
        </IonButton>
      </div>

      <!-- AI section -->
      <div class="create-guide__ai">
        <div class="create-guide__ai-label">
          <IonIcon :icon="sparklesOutline" class="create-guide__ai-label-icon" />
          {{ t('editor.aiGenerate') }}
        </div>
        <AiGeneratePanel
          :custom-system-prompt="aiSystemPrompt"
          :user-prefix="aiUserPrefix"
          :placeholder="t('editor.aiPromptPlaceholder')"
          @apply="applyAiOutput"
        />
      </div>
    </div>

    <!-- Normal editor -->
    <div v-else class="editor-container">
      <!-- Quick-insert toolbar -->
      <div class="editor-toolbar">
        <button
          v-for="item in toolbarItems"
          :key="item.label"
          class="editor-toolbar__btn"
          :title="t(item.title)"
          @click="insertAtCursor(item.insert)"
        >
          {{ item.label }}
        </button>
      </div>
      <textarea
        ref="textareaRef"
        v-model="content"
        class="editor-textarea"
        :placeholder="t('editor.editPlaceholder', { file: fileName })"
        spellcheck="false"
      />
    </div>
  </LayoutPage>
</template>

<style scoped>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.editor-toolbar {
  display: flex;
  gap: 4px;
  padding: 6px var(--adv-space-md);
  border-bottom: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  overflow-x: auto;
  flex-shrink: 0;
  -webkit-overflow-scrolling: touch;
}

.editor-toolbar::-webkit-scrollbar {
  display: none;
}

.editor-toolbar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 32px;
  padding: 0 10px;
  border-radius: var(--adv-radius-sm);
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-elevated);
  color: var(--adv-text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  -webkit-tap-highlight-color: transparent;
  transition:
    background 0.15s ease,
    border-color 0.15s ease;
}

.editor-toolbar__btn:hover {
  background: rgba(99, 102, 241, 0.08);
  border-color: rgba(99, 102, 241, 0.3);
}

.editor-toolbar__btn:active {
  transform: scale(0.95);
}

.editor-textarea {
  width: 100%;
  flex: 1;
  border: none;
  outline: none;
  resize: none;
  padding: var(--adv-space-md);
  padding-bottom: calc(var(--adv-space-md) + env(safe-area-inset-bottom, 0px));
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 14px;
  line-height: 1.6;
  background: var(--ion-background-color, #fff);
  color: var(--ion-text-color, #000);
  box-sizing: border-box;
  transition: background-color var(--adv-duration-slow) var(--adv-ease-default);
}

.save-status {
  font-size: var(--adv-font-caption);
  padding-right: var(--adv-space-xs);
  display: flex;
  align-items: center;
  gap: 4px;
}

.save-status::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.save-status--saving::before {
  background: var(--ion-color-warning);
}

.save-status--saved::before {
  background: var(--ion-color-success);
}

.save-status--unsaved::before {
  background: var(--ion-color-danger);
}

/* ── Create guide ── */
.create-guide {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-lg);
  padding: var(--adv-space-xl) var(--adv-space-lg);
  max-width: 560px;
  margin: 0 auto;
}

.create-guide__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--adv-space-sm);
}

.create-guide__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: var(--ion-color-primary);
}

.create-guide__title {
  font-size: var(--adv-font-heading);
  font-weight: 600;
  margin: 0;
}

.create-guide__desc {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.create-guide__filename {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--adv-text-tertiary);
  background: var(--adv-surface-elevated);
  border: 1px solid var(--adv-border-subtle);
  border-radius: var(--adv-radius-sm);
  padding: 4px 10px;
}

.create-guide__actions {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-sm);
}

.create-guide__ai {
  border-top: 1px solid var(--adv-border-subtle);
  padding-top: var(--adv-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
}

.create-guide__ai-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-secondary);
}

.create-guide__ai-label-icon {
  font-size: 14px;
  color: #8b5cf6;
}
</style>
