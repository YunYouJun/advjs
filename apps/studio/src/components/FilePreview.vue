<script setup lang="ts">
import { getFileTypeFromPath, getIconFromFileType } from '@advjs/gui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  content?: string
  originalContent?: string
  language?: string
  readonly?: boolean
  filename?: string
}>(), {
  content: '',
  originalContent: undefined,
  language: 'plaintext',
  readonly: true,
  filename: '',
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

async function initEditor() {
  if (!editorContainer.value)
    return

  const monacoModule = await import('monaco-editor')
  monaco = monacoModule

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

    diffEditor.setModel({
      original: monaco.editor.createModel(props.originalContent || '', lang),
      modified: monaco.editor.createModel(props.content, lang),
    })
  }
  else {
    const isMobile = window.innerWidth < 768
    editor = monaco.editor.create(editorContainer.value, {
      value: props.content,
      language: lang,
      readOnly: props.readonly,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: isMobile ? 14 : 13,
      lineNumbers: 'on',
      wordWrap: 'on',
      theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs',
    })

    if (!props.readonly) {
      editor.onDidChangeModelContent(() => {
        emit('update:content', editor.getValue())
      })

      // Cmd/Ctrl+S save shortcut
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        emit('save')
      })
    }
  }
}

function disposeEditor() {
  if (diffEditor) {
    const model = diffEditor.getModel()
    model?.original?.dispose()
    model?.modified?.dispose()
    diffEditor.dispose()
    diffEditor = null
  }
  if (editor) {
    editor.getModel()?.dispose()
    editor.dispose()
    editor = null
  }
}

watch([() => props.content, () => props.originalContent, () => props.filename], () => {
  disposeEditor()
  initEditor()
})

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  disposeEditor()
})
</script>

<template>
  <div class="file-preview">
    <div v-if="!content && !filename" class="file-preview__empty">
      <div class="file-preview__empty-icon">
        <span class="i-vscode-icons-default-file" style="font-size: 48px; width: 48px; height: 48px;" />
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
  font-size: 18px;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.file-preview__filename {
  font-size: 13px;
  font-weight: 500;
  color: var(--adv-text-primary, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.file-preview__type-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--adv-text-secondary, #666);
  background: var(--adv-border-subtle, #f0f0f0);
  padding: 2px 8px;
  border-radius: 10px;
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
  font-size: 14px;
  margin: 0;
}
</style>
