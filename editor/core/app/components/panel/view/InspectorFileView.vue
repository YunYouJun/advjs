<script setup lang="ts">
import type { IDisposable, editor as MonacoEditor } from 'monaco-editor'
import { AdvGameLoadStatusEnum, useAdvContext } from '@advjs/client'
import { parseCharacterMd } from '@advjs/parser'
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { advMonacoTheme, registerAdvMonacoLanguage } from '../../../../../../packages/shared/adv-monaco'
import { insertStoryTemplate } from '../../../utils/story-templates'
import CharacterAvatarPanel from '../../character/CharacterAvatarPanel.vue'
import CharacterVisualPanel from '../../character/CharacterVisualPanel.vue'
import AEInlineAudioEditor from '../audio/AEInlineAudioEditor.vue'
import ContextDocument from '../context/ContextDocument.vue'

const { $adv } = useAdvContext()
const file = useFileStore()
const monaco = useMonacoStore()
const game = useGameStore()
const project = useProjectStore()
const { locale } = useEditorLocale()
const colorMode = useColorMode()
const zh = computed(() => locale.value === 'zh-CN')
const reading = shallowRef(false)
const saving = shallowRef(false)
const error = shallowRef('')
const audioSelection = shallowRef<{ content: string, line: number }>()
const markdown = computed(() => file.fileName.endsWith('.md'))
const character = computed(() => {
  if (!reading.value || !file.fileName.endsWith('.character.md'))
    return undefined
  try {
    return parseCharacterMd(monaco.fileContent)
  }
  catch {
    return undefined
  }
})
const gameConfig = computed(() => file.fileName.endsWith('.adv.json'))
let editor: MonacoEditor.IStandaloneCodeEditor | undefined
let editorPath = ''
let active = true
let positionSequence = 0
const restoringPosition = shallowRef(false)
const listeners: IDisposable[] = []
let unregisterChapterEditor: (() => void) | undefined
let unregisterSourceEditor: (() => void) | undefined
const editorReady = shallowRef(false)
// Monaco falls back to the light theme for unknown names, so define the ADV
// language and themes before the editor is created.
const languagesReady = shallowRef(false)
onMounted(async () => {
  registerAdvMonacoLanguage(await useMonaco())
  if (active)
    languagesReady.value = true
})
const sourceReady = computed(() => Boolean(editorReady.value && editor && active && !restoringPosition.value && !file.loading && file.fileKind === 'text' && editorPath === file.openedFilePath))
const chapterReady = computed(() => Boolean(sourceReady.value && file.openedFileHandle && file.fileName.endsWith('.adv.md')))
function savePosition() {
  if (!editor || !editorPath || restoringPosition.value)
    return
  const position = editor.getPosition()
  if (position)
    monaco.positions[editorPath] = { ...position, scrollTop: editor.getScrollTop(), scrollLeft: editor.getScrollLeft() }
}
async function restorePosition() {
  const request = ++positionSequence
  const path = file.openedFilePath
  restoringPosition.value = true
  editorPath = path
  await nextTick()
  if (!active || request !== positionSequence || path !== file.openedFilePath)
    return
  const position = monaco.positions[editorPath]
  editor?.setPosition(position ?? { lineNumber: 1, column: 1 })
  editor?.setScrollPosition({ scrollTop: position?.scrollTop ?? 0, scrollLeft: position?.scrollLeft ?? 0 })
  restoringPosition.value = false
}
function loaded(instance: MonacoEditor.IStandaloneCodeEditor) {
  editor = instance
  editorReady.value = true
  void restorePosition()
  unregisterSourceEditor?.()
  unregisterSourceEditor = monaco.registerSourceEditor({
    canNavigate: path => sourceReady.value && path === file.openedFilePath && editor?.getValue() === monaco.fileContent,
    async navigate(source, isCurrent) {
      reading.value = false
      await nextTick()
      if (!isCurrent() || !sourceReady.value || !editor || source.path !== file.openedFilePath || editor.getValue() !== monaco.fileContent)
        return false
      const model = editor.getModel()
      if (!model)
        return false
      const position = model.validatePosition({ lineNumber: source.line ?? 1, column: source.column ?? 1 })
      editor.layout()
      editor.setPosition(position)
      editor.revealPositionInCenterIfOutsideViewport(position)
      editor.focus()
      return true
    },
  })
  unregisterChapterEditor?.()
  unregisterChapterEditor = monaco.registerChapterEditor({
    canInsert: () => chapterReady.value,
    async insert(kind, language) {
      const path = file.openedFilePath
      reading.value = false
      await nextTick()
      // Menus restore focus to their trigger when closing. Focus the source only
      // after that teardown, so typing and undo work immediately after insertion.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      if (active && chapterReady.value && editor && path === file.openedFilePath && editor.getValue() === monaco.fileContent)
        insertStoryTemplate(editor, kind, language)
    },
  })
  listeners.push(instance.onDidChangeCursorPosition(savePosition), instance.onDidScrollChange(savePosition))
}
watch(() => [file.openedFilePath, file.openVersion], () => {
  savePosition()
  void restorePosition()
}, { flush: 'pre' })
onBeforeUnmount(() => {
  active = false
  editorReady.value = false
  unregisterChapterEditor?.()
  unregisterSourceEditor?.()
  savePosition()
  listeners.forEach(listener => listener.dispose())
})
watch(() => file.openVersion, () => {
  audioSelection.value = undefined
  reading.value = false
  error.value = ''
})
function inspectAudio() {
  if (!chapterReady.value || !editor || editor.getValue() !== monaco.fileContent)
    return
  audioSelection.value = { content: monaco.fileContent, line: editor.getPosition()?.lineNumber ?? 1 }
}
function applyAudio(value: { expected: string, content: string }) {
  if (!chapterReady.value || !editor || editor.getValue() !== value.expected || monaco.fileContent !== value.expected)
    return
  const model = editor.getModel()
  if (!model)
    return
  editor.pushUndoStop()
  const applied = editor.executeEdits('advjs.audio-operations', [{ range: model.getFullModelRange(), text: value.content, forceMoveMarkers: true }])
  editor.pushUndoStop()
  if (applied) {
    monaco.fileContent = value.content
    audioSelection.value = undefined
    editor.focus()
  }
}
async function save() {
  saving.value = true
  error.value = ''
  try {
    await file.saveOpenedFile()
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : String(cause) }
  finally { saving.value = false }
}
function goToNode() {
  if (game.startChapter && game.startNode)
    $adv.runtime.go({ chapterId: game.startChapter, nodeId: game.startNode })
}
</script>

<template>
  <div class="file-source">
    <AGUIToolbar :items="[]" :label="zh ? '文件编辑' : 'File editor'">
      <template #before-toolbar>
        <span class="file-title" :title="file.openedFilePath || file.fileName">{{ file.fileName }}{{ file.isDirty ? ' •' : '' }}</span>
      </template>
      <template #after-toolbar>
        <AGUIButton v-if="markdown" :aria-pressed="!reading" @click="reading = false">
          {{ zh ? '源码' : 'Source' }}
        </AGUIButton>
        <AGUIButton v-if="markdown" :aria-pressed="reading" @click="reading = true">
          {{ zh ? '阅读' : 'Reading' }}
        </AGUIButton>
        <AGUIButton v-if="file.fileName.endsWith('.adv.md') && !reading" :disabled="!chapterReady || saving" @click="inspectAudio">
          {{ zh ? '场景音频' : 'Scene audio' }}
        </AGUIButton>
        <AGUIButton v-if="file.openedFileHandle" :loading="saving" :disabled="!file.isDirty || saving" @click="save">
          {{ zh ? '保存' : 'Save' }}
        </AGUIButton>
        <AGUIButton v-if="file.isDirty" :disabled="saving" @click="file.discardOpenedFileChanges()">
          {{ zh ? '放弃修改' : 'Discard changes' }}
        </AGUIButton>
        <AGUIButton v-if="gameConfig" @click="game.loadGameFromJSONStr(monaco.fileContent)">
          {{ zh ? '加载' : 'Load' }}
        </AGUIButton>
        <AGUIButton v-if="gameConfig && game.client.loadStatus === AdvGameLoadStatusEnum.SUCCESS" @click="goToNode">
          {{ zh ? '开始' : 'Start' }}
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <AEAdvConfigActions v-if="gameConfig && game.client.loadStatus === AdvGameLoadStatusEnum.SUCCESS" />
    <div v-if="file.externalConflict" class="file-conflict" role="alert">
      <span>{{ zh ? '文件在外部发生变化，当前编辑内容尚未保存。' : 'This file changed outside the Editor while you have unsaved edits.' }}</span>
      <AGUIButton @click="file.acceptExternalChange()">
        {{ zh ? '使用外部版本' : 'Use external' }}
      </AGUIButton>
      <AGUIButton @click="file.keepLocalChange().catch(cause => error = String(cause))">
        {{ zh ? '保留我的版本' : 'Keep mine' }}
      </AGUIButton>
    </div>
    <p v-if="error" class="file-error" role="alert">
      {{ error }}
    </p>
    <div v-if="reading" class="file-reading">
      <template v-if="character">
        <AGUIDetails :title="$t('characters.visual.title')" open>
          <CharacterVisualPanel :character="character" />
        </AGUIDetails>
        <AGUIDetails v-if="Object.keys(character.avatars ?? {}).length" :title="$t('characters.detail.avatars')" open>
          <CharacterAvatarPanel :character="character" />
        </AGUIDetails>
      </template>
      <ContextDocument :content="monaco.fileContent" />
    </div>
    <ClientOnly>
      <LazyMonacoEditor
        v-if="languagesReady"
        v-show="!reading"
        class="file-monaco" :model-value="monaco.fileContent" :lang="monaco.language"
        :options="{ ...monaco.options, theme: advMonacoTheme(colorMode.value === 'dark') }"
        :editor-options="{ automaticLayout: true }"
        @update:model-value="monaco.fileContent = $event"
        @load="loaded"
      />
      <p v-else-if="!reading" class="file-reading" role="status">
        {{ zh ? '正在加载编辑器…' : 'Loading editor…' }}
      </p>
      <template #fallback>
        <p class="file-reading" role="status">
          {{ zh ? '正在加载编辑器…' : 'Loading editor…' }}
        </p>
      </template>
    </ClientOnly>
    <AEInlineAudioEditor v-if="audioSelection && !reading" :content="audioSelection.content" :line="audioSelection.line" :current-content="monaco.fileContent" :catalog="project.project?.compilation.project.assets" :zh="zh" :disabled="saving || !chapterReady" @apply="applyAudio" @close="audioSelection = undefined" />
  </div>
</template>

<style scoped>
.file-source {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
}
.file-title {
  flex: 1;
  min-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-conflict {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px;
  font-size: 12px;
  color: var(--agui-c-warning-text);
  border-bottom: 1px solid var(--agui-c-divider);
}
.file-conflict > span {
  flex: 1;
  min-width: 160px;
}
.file-error {
  padding: 8px;
  margin: 0;
  font-size: 12px;
  color: var(--agui-c-danger-text);
}
.file-reading {
  flex: 1;
  min-height: 0;
  padding: 12px;
  overflow: auto;
}
.file-monaco {
  flex: 1;
  min-height: 0;
}
</style>
