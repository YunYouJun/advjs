<script setup lang="ts">
import type { FileDiff } from '../utils/lineDiff'
import { IonButton, IonIcon } from '@ionic/vue'
import { saveOutline } from 'ionicons/icons'
import MarkdownIt from 'markdown-it'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudioStore } from '../stores/useStudioStore'
import { readFileFromDir } from '../utils/fileAccess'
import { computeLineDiff } from '../utils/lineDiff'
import FileDiffPreview from './FileDiffPreview.vue'

const props = withDefaults(defineProps<{
  content: string
  /** Enable word-wrap in code blocks */
  wordWrap?: boolean
  /** In-memory file diffs to display after save actions */
  fileDiffs?: FileDiff[]
}>(), {
  wordWrap: false,
  fileDiffs: undefined,
})

const emit = defineEmits<{
  save: [payload: { type: 'character' | 'chapter' | 'scene', content: string, filename: string }]
}>()

const { t } = useI18n()

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const rendered = computed(() => md.render(props.content))

/** Strip surrounding quotes (single or double) from a YAML value */
function stripQuotes(s: string): string {
  const trimmed = s.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

// Module-scope regexes for content detection
const CODE_BLOCK_RE = /```(?:markdown|md|yaml)?\n([\s\S]+?)```/g
const FRONTMATTER_ID_RE = /^id:\s*(.+)/m
const FRONTMATTER_NAME_RE = /^name:\s*(.+)/m
const CHAR_META_RE = /^(?:aliases|tags):/m
const CHAR_SECTION_RE = /^##\s*(?:性格|Personality|背景|Background|外貌|Appearance)/m
const PLOT_SUMMARY_RE = /plotSummary/i
const DIALOG_RE = /^@\w+(?:\(.*?\))?\s*$/m
const SCENE_HEADER_RE = /^【.+】/m
const CHAPTER_TITLE_RE = /^(?:title:\s*(.+)|#\s+(.+))/m
const SCENE_META_RE = /^(?:imagePrompt|type):/m
const SCENE_DESC_RE = /^description:/m
const SAFE_FILENAME_RE = /[^a-z0-9\u4E00-\u9FFF]+/g
const TRIM_UNDERSCORE_RE = /^_|_$/g

/**
 * Detect saveable ADV content blocks in the message.
 */
const saveableBlocks = computed(() => {
  const blocks: { type: 'character' | 'chapter' | 'scene', content: string, filename: string, label: string }[] = []
  const matches = props.content.matchAll(CODE_BLOCK_RE)
  for (const match of matches) {
    const code = match[1].trim()

    // Character card: frontmatter with id + name + (aliases|tags) or personality sections
    if (
      code.startsWith('---')
      && FRONTMATTER_ID_RE.test(code)
      && FRONTMATTER_NAME_RE.test(code)
      && (CHAR_META_RE.test(code) || CHAR_SECTION_RE.test(code))
    ) {
      const id = stripQuotes(code.match(FRONTMATTER_ID_RE)?.[1] || 'character')
      const name = stripQuotes(code.match(FRONTMATTER_NAME_RE)?.[1] || id)
      blocks.push({
        type: 'character',
        content: code,
        filename: `adv/characters/${id}.character.md`,
        label: name,
      })
    }
    // Chapter script: has plotSummary, @Dialog, or scene header 【】
    else if (
      (code.startsWith('---') && PLOT_SUMMARY_RE.test(code))
      || DIALOG_RE.test(code)
      || SCENE_HEADER_RE.test(code)
    ) {
      const titleMatch = code.match(CHAPTER_TITLE_RE)
      const title = stripQuotes(titleMatch?.[1] || titleMatch?.[2] || 'new_chapter')
      const safeTitle = title.toLowerCase().replace(SAFE_FILENAME_RE, '_').replace(TRIM_UNDERSCORE_RE, '')
      blocks.push({
        type: 'chapter',
        content: code,
        filename: `adv/chapters/${safeTitle}.adv.md`,
        label: title,
      })
    }
    // Scene definition: frontmatter with id + (imagePrompt|type|description)
    else if (
      code.startsWith('---')
      && FRONTMATTER_ID_RE.test(code)
      && (SCENE_META_RE.test(code) || SCENE_DESC_RE.test(code))
      && !CHAR_META_RE.test(code)
    ) {
      const id = stripQuotes(code.match(FRONTMATTER_ID_RE)?.[1] || 'scene')
      const name = stripQuotes(code.match(FRONTMATTER_NAME_RE)?.[1] || id)
      blocks.push({
        type: 'scene',
        content: code,
        filename: `adv/scenes/${id}.md`,
        label: name,
      })
    }
  }
  return blocks
})

function handleSave(block: typeof saveableBlocks.value[number]) {
  emit('save', { type: block.type, content: block.content, filename: block.filename })
}

// --- Pre-computed diffs for saveable blocks ---
const studioStore = useStudioStore()
const precomputedDiffs = ref<Map<string, FileDiff>>(new Map())
const expandedDiffs = ref<Set<string>>(new Set())

watchEffect(async () => {
  const blocks = saveableBlocks.value
  if (!blocks.length)
    return

  const project = studioStore.currentProject
  if (!project?.dirHandle)
    return

  const newDiffs = new Map<string, FileDiff>()
  for (const block of blocks) {
    try {
      const existing = await readFileFromDir(project.dirHandle, block.filename)
      if (existing && existing !== block.content) {
        const diff = computeLineDiff(block.filename, existing, block.content)
        if (diff.addedCount > 0 || diff.removedCount > 0)
          newDiffs.set(block.filename, diff)
      }
    }
    catch {
      // File doesn't exist yet — no diff to show
    }
  }
  precomputedDiffs.value = newDiffs
})

function toggleDiffExpand(filename: string) {
  if (expandedDiffs.value.has(filename))
    expandedDiffs.value.delete(filename)
  else
    expandedDiffs.value.add(filename)
}
</script>

<template>
  <div class="markdown-body" :class="{ 'markdown-body--wrap': wordWrap }" v-html="rendered" />
  <!-- Save buttons for detected ADV content blocks -->
  <div v-if="saveableBlocks.length" class="save-blocks">
    <div v-for="(block, i) in saveableBlocks" :key="i" class="save-block">
      <div class="save-block__row">
        <IonButton size="small" fill="outline" color="primary" class="save-block__btn" @click="handleSave(block)">
          <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -- Ionic Web Component requires native slot -->
          <IonIcon slot="start" :icon="saveOutline" />
          {{ t('contentEditor.saveToProject', { type: t(`contentEditor.saveType${block.type.charAt(0).toUpperCase() + block.type.slice(1)}`), label: block.label }) }}
        </IonButton>
        <button
          v-if="precomputedDiffs.has(block.filename)"
          class="save-block__diff-toggle"
          @click="toggleDiffExpand(block.filename)"
        >
          <span class="save-block__diff-added">+{{ precomputedDiffs.get(block.filename)!.addedCount }}</span>
          <span class="save-block__diff-removed">-{{ precomputedDiffs.get(block.filename)!.removedCount }}</span>
        </button>
      </div>
      <span class="save-block__path">{{ block.filename }}</span>
      <FileDiffPreview
        v-if="expandedDiffs.has(block.filename) && precomputedDiffs.has(block.filename)"
        :diff="precomputedDiffs.get(block.filename)!"
      />
    </div>
  </div>
  <!-- File diff previews -->
  <div v-if="props.fileDiffs?.length" class="diff-previews">
    <FileDiffPreview
      v-for="diff in props.fileDiffs"
      :key="diff.filename"
      :diff="diff"
    />
  </div>
</template>

<style scoped>
.markdown-body {
  line-height: 1.6;
}

.markdown-body :deep(p) {
  margin: 0 0 0.5em;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(pre) {
  background: var(--ion-color-step-100, rgba(0, 0, 0, 0.06));
  border-radius: 8px;
  padding: 0.75em 1em;
  overflow-x: auto;
  margin: 0.5em 0;
  font-size: 0.875em;
}

/* Word-wrap mode for code blocks */
.markdown-body--wrap :deep(pre) {
  white-space: pre-wrap;
  word-break: break-word;
  overflow-x: hidden;
}

.markdown-body--wrap :deep(pre code) {
  white-space: pre-wrap;
  word-break: break-word;
}

.markdown-body :deep(code) {
  font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
  font-size: 0.88em;
}

.markdown-body :deep(:not(pre) > code) {
  background: var(--ion-color-step-100, rgba(0, 0, 0, 0.06));
  border-radius: 4px;
  padding: 0.15em 0.4em;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.4em;
  margin: 0.4em 0;
}

.markdown-body :deep(li + li) {
  margin-top: 0.2em;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--ion-color-primary, #3880ff);
  margin: 0.5em 0;
  padding: 0.25em 0.8em;
  color: var(--adv-text-secondary, var(--ion-color-step-600, #666));
}

.markdown-body :deep(a) {
  color: var(--ion-color-primary, #3880ff);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.markdown-body :deep(a:hover) {
  opacity: 0.8;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
  width: 100%;
  font-size: 0.9em;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--ion-color-step-200, rgba(0, 0, 0, 0.12));
  padding: 0.4em 0.6em;
}

.markdown-body :deep(th) {
  background: var(--ion-color-step-50, rgba(0, 0, 0, 0.03));
  font-weight: 600;
}

.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--ion-color-step-200, rgba(0, 0, 0, 0.12));
  margin: 0.8em 0;
}

.markdown-body :deep(strong) {
  font-weight: 600;
}

.markdown-body :deep(img) {
  max-width: 100%;
  border-radius: 6px;
}

/* Save blocks */
.save-blocks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.save-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.save-block__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.save-block__btn {
  --border-radius: 8px;
  text-transform: none;
  font-weight: 500;
}

.save-block__diff-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.1));
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s;
}

.save-block__diff-toggle:hover {
  background: var(--adv-surface-elevated, #f5f5f5);
}

.save-block__diff-added {
  color: #16a34a;
}

.save-block__diff-removed {
  color: #dc2626;
}

:root.dark .save-block__diff-added {
  color: #4ade80;
}

:root.dark .save-block__diff-removed {
  color: #f87171;
}

.save-block__path {
  font-size: 11px;
  color: var(--adv-text-tertiary, #999);
  padding-left: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
</style>
