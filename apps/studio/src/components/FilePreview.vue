<script setup lang="ts">
import type { Text as YText } from 'yjs'
import { getFileTypeFromPath, getIconFromFileType } from '@advjs/gui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getMonaco, registerCharacterFrontmatterCompletionIfNeeded } from '../utils/monacoSetup'

const props = withDefaults(defineProps<{
  content?: string
  originalContent?: string
  language?: string
  readonly?: boolean
  filename?: string
  collabText?: YText | null
  revealLine?: number
  revealColumn?: number
}>(), {
  content: '',
  originalContent: undefined,
  language: 'plaintext',
  readonly: true,
  filename: '',
  collabText: null,
  revealLine: undefined,
  revealColumn: undefined,
})

const emit = defineEmits<{
  (e: 'update:content', value: string): void
  (e: 'save'): void
}>()

const { t } = useI18n()
const editorContainer = ref<HTMLDivElement>()

let editor: any = null
let diffEditor: any = null
let monaco: any = null
let monacoBinding: any = null
let editorModel: any = null
let diffOriginalModel: any = null
let diffModifiedModel: any = null
let initToken = 0

const EXT_LANGUAGE_MAP: Record<string, string> = {
  'ts': 'typescript',
  'tsx': 'typescript',
  'js': 'javascript',
  'jsx': 'javascript',
  'json': 'json',
  'md': 'markdown',
  'adv.md': 'markdown',
  'vue': 'html',
  'html': 'html',
  'css': 'css',
  'scss': 'scss',
  'yaml': 'yaml',
  'yml': 'yaml',
  'xml': 'xml',
  'svg': 'xml',
}

/** Language label for the type badge */
const EXT_LABEL_MAP: Record<string, string> = {
  'adv.md': 'ADV Script',
  'md': 'Markdown',
  'ts': 'TypeScript',
  'tsx': 'TSX',
  'js': 'JavaScript',
  'jsx': 'JSX',
  'vue': 'Vue',
  'json': 'JSON',
  'yaml': 'YAML',
  'yml': 'YAML',
  'html': 'HTML',
  'css': 'CSS',
  'scss': 'SCSS',
  'xml': 'XML',
  'svg': 'SVG',
}

/** Get the UnoCSS vscode-icons class for the current file */
const fileIconClass = computed(() => {
  if (!props.filename)
    return 'i-vscode-icons-default-file'
  return getIconFromFileType(getFileTypeFromPath(props.filename))
})

/** Get a human-readable label for the file type badge */
const fileTypeLabel = computed(() => {
  if (!props.filename)
    return 'File'
  if (props.filename.endsWith('.adv.md'))
    return 'ADV Script'
  const ext = props.filename.split('.').pop()?.toLowerCase() || ''
  return EXT_LABEL_MAP[ext] || ext.toUpperCase() || 'File'
})

function detectLanguage(filename: string): string {
  if (!filename)
    return props.language

  // Check compound extensions first
  if (filename.endsWith('.adv.md'))
    return 'markdown'

  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return EXT_LANGUAGE_MAP[ext] || props.language
}

function getInitialEditorValue(): string {
  if (!props.collabText)
    return props.content

  const sharedValue = props.collabText.toString()
  if (sharedValue.length > 0)
    return sharedValue

  if (props.content)
    props.collabText.insert(0, props.content)

  return props.collabText.toString()
}

async function bindCollabText(model: any) {
  if (!props.collabText || props.readonly)
    return

  const value = props.collabText.toString()
  if (value !== model.getValue())
    model.setValue(value)

  const { MonacoBinding } = await import('y-monaco')
  monacoBinding = new MonacoBinding(props.collabText, model, new Set([editor]))
}

async function initEditor() {
  if (!editorContainer.value)
    return

  const token = ++initToken
  const monacoModule = await getMonaco()
  if (token !== initToken)
    return
  monaco = monacoModule

  // Register character frontmatter schema completions (idempotent — only
  // actually registers on first call).
  await registerCharacterFrontmatterCompletionIfNeeded()
  if (token !== initToken)
    return

  const lang = detectLanguage(props.filename)
  const isDiff = props.originalContent !== undefined

  if (isDiff) {
    diffEditor = monaco.editor.createDiffEditor(editorContainer.value, {
      readOnly: props.readonly,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      renderSideBySide: window.innerWidth >= 768,
    })

    diffOriginalModel = monaco.editor.createModel(props.originalContent || '', lang)
    diffModifiedModel = monaco.editor.createModel(props.content, lang)
    diffEditor.setModel({
      original: diffOriginalModel,
      modified: diffModifiedModel,
    })
  }
  else {
    const isMobile = window.innerWidth < 768
    editorModel = monaco.editor.createModel(getInitialEditorValue(), lang)
    editor = monaco.editor.create(editorContainer.value, {
      model: editorModel,
      readOnly: props.readonly,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: isMobile ? 14 : 13,
      lineNumbers: 'on',
      wordWrap: 'on',
      theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs',
    })

    await bindCollabText(editorModel)
    if (token !== initToken)
      return

    if (!props.readonly) {
      editor.onDidChangeModelContent(() => {
        emit('update:content', editor.getValue())
      })

      // Cmd/Ctrl+S save shortcut
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        emit('save')
      })
    }
    revealSourcePosition()
  }
}

function revealSourcePosition() {
  if (!editor || props.originalContent !== undefined || !props.revealLine)
    return
  const position = {
    lineNumber: props.revealLine,
    column: props.revealColumn ?? 1,
  }
  editor.revealPositionInCenter(position)
  editor.setPosition(position)
  editor.focus()
}

function disposeEditor() {
  initToken++
  if (monacoBinding) {
    monacoBinding.destroy()
    monacoBinding = null
  }
  if (diffEditor) {
    diffEditor.dispose()
    diffEditor = null
  }
  diffOriginalModel?.dispose()
  diffModifiedModel?.dispose()
  diffOriginalModel = null
  diffModifiedModel = null
  if (editor) {
    editor.dispose()
    editor = null
  }
  editorModel?.dispose()
  editorModel = null
}

function recreateEditor() {
  disposeEditor()
  void initEditor()
}

watch(
  [() => props.originalContent, () => props.filename, () => props.readonly, () => props.collabText],
  recreateEditor,
)

watch(() => props.content, (value) => {
  if (props.collabText)
    return

  if (diffEditor) {
    if (diffModifiedModel && value !== diffModifiedModel.getValue())
      diffModifiedModel.setValue(value)
    return
  }

  if (editorModel && value !== editorModel.getValue())
    editorModel.setValue(value)
})

watch([() => props.revealLine, () => props.revealColumn], revealSourcePosition)

onMounted(() => {
  void initEditor()
})

onBeforeUnmount(() => {
  disposeEditor()
})
</script>

<template>
  <div class="file-preview">
    <div v-if="!content && !filename" class="file-preview__empty">
      <div class="file-preview__empty-icon">
        <span class="i-vscode-icons-default-file" style="font-size: var(--adv-font-display-xl); width: 48px; height: 48px;" />
      </div>
      <p>{{ t('workspace.selectFile') }}</p>
    </div>
    <template v-else>
      <!-- File header bar: vscode icon + name + type badge -->
      <div class="file-preview__header">
        <span class="file-preview__type-icon" :class="fileIconClass" />
        <span class="file-preview__filename">{{ filename }}</span>
        <span class="file-preview__type-badge">{{ fileTypeLabel }}</span>
      </div>
      <div ref="editorContainer" class="file-preview__editor" />
    </template>
  </div>
</template>

<style scoped>
.file-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.file-preview__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--adv-border-subtle, #e5e5e5);
  background: var(--adv-surface-card, var(--ion-background-color));
  min-height: 36px;
  flex-shrink: 0;
}

.file-preview__type-icon {
  font-size: var(--adv-font-subtitle);
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.file-preview__filename {
  font-size: var(--adv-font-body-sm);
  font-weight: 500;
  color: var(--adv-text-primary, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.file-preview__type-badge {
  font-size: var(--adv-font-caption);
  font-weight: 500;
  color: var(--adv-text-secondary, #666);
  background: var(--adv-border-subtle, #f0f0f0);
  padding: 2px 8px;
  border-radius: var(--adv-radius-md);
  white-space: nowrap;
  flex-shrink: 0;
}

.file-preview__editor {
  flex: 1;
  min-height: 200px;
}

.file-preview__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--adv-text-tertiary, #999);
}

.file-preview__empty-icon {
  opacity: 0.4;
}

.file-preview__empty p {
  font-size: var(--adv-font-body-sm);
  margin: 0;
}
</style>
