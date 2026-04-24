<!--
  Streaming file preview pane. Generic over any `{path, content}[]` stream,
  so it can be reused for:
    • Phase M10 Source-to-Project import wizard (current use)
    • future "regenerate one chapter" flows
    • any other LLM-produces-files scenario

  Behavior:
    • File list on the left (virtual-friendly <ul>)
    • Monaco-free rendered markdown on the right (ScrollTo latest by default)
    • Highlights the latest appended file unless the user manually selects one
-->
<script setup lang="ts">
import type { TemplateFile } from '../../utils/projectTemplate'
import { IonIcon } from '@ionic/vue'
import { documentOutline, documentTextOutline, folderOutline } from 'ionicons/icons'
import { computed, ref, watch } from 'vue'
import MarkdownMessage from '../MarkdownMessage.vue'

const props = defineProps<{
  files: TemplateFile[]
  /** When true, auto-select the newest file as it streams in. */
  autoFollow?: boolean
  emptyLabel?: string
}>()

/** Currently selected file path, either user-selected or auto-followed. */
const userSelectedPath = ref<string | null>(null)

const effectivePath = computed<string | null>(() => {
  if (userSelectedPath.value && props.files.some(f => f.path === userSelectedPath.value))
    return userSelectedPath.value
  if (props.files.length === 0)
    return null
  // Otherwise follow latest
  return props.files.at(-1)?.path ?? null
})

const selectedFile = computed(() => props.files.find(f => f.path === effectivePath.value) ?? null)

/**
 * Reset user selection when files list shrinks to zero (new run).
 * Don't reset on every change — that would fight against manual picks.
 */
watch(() => props.files.length, (n) => {
  if (n === 0)
    userSelectedPath.value = null
})

function iconForPath(path: string) {
  if (path.endsWith('.character.md'))
    return documentTextOutline
  if (path.startsWith('adv/chapters/'))
    return documentOutline
  if (path.startsWith('adv/scenes/') || path.startsWith('adv/locations/'))
    return folderOutline
  return documentOutline
}

function labelForPath(path: string): string {
  // Strip directory prefix for compact display
  const parts = path.split('/')
  return parts.at(-1) ?? path
}

function groupForPath(path: string): string {
  if (path.startsWith('adv/characters/'))
    return 'characters'
  if (path.startsWith('adv/chapters/'))
    return 'chapters'
  if (path.startsWith('adv/scenes/'))
    return 'scenes'
  if (path.startsWith('adv/locations/'))
    return 'locations'
  if (path.startsWith('adv/knowledge/'))
    return 'knowledge'
  if (path.startsWith('adv/'))
    return 'meta'
  return 'root'
}

/**
 * Files grouped + ordered for stable UI. Uses `toSorted` via manual copy
 * to avoid mutating props and to keep order roughly: characters → chapters
 * → scenes → locations → knowledge → meta → root.
 */
const GROUP_ORDER = ['characters', 'chapters', 'scenes', 'locations', 'knowledge', 'meta', 'root']
const groupedFiles = computed(() => {
  const groups = new Map<string, TemplateFile[]>()
  for (const f of props.files) {
    const g = groupForPath(f.path)
    if (!groups.has(g))
      groups.set(g, [])
    groups.get(g)!.push(f)
  }
  return GROUP_ORDER
    .filter(g => groups.has(g))
    .map(g => ({ group: g, files: groups.get(g)! }))
})
</script>

<template>
  <section class="preview-pane" role="region" :aria-label="$t('importSource.previewTitle')">
    <div v-if="files.length === 0" class="preview-pane__empty">
      <IonIcon :icon="documentOutline" class="preview-pane__empty-icon" />
      <p>{{ emptyLabel ?? $t('importSource.previewEmpty') }}</p>
    </div>
    <div v-else class="preview-pane__layout">
      <!-- File list (left) -->
      <nav class="preview-pane__list" :aria-label="$t('importSource.fileCount', { count: files.length })">
        <div
          v-for="group in groupedFiles"
          :key="group.group"
          class="preview-pane__group"
        >
          <header class="preview-pane__group-title">
            {{ group.group }}
            <span class="preview-pane__group-count">{{ group.files.length }}</span>
          </header>
          <ul>
            <li
              v-for="f in group.files"
              :key="f.path"
            >
              <button
                class="preview-pane__item"
                :class="{ 'is-active': f.path === effectivePath }"
                :aria-current="f.path === effectivePath ? 'true' : undefined"
                @click="userSelectedPath = f.path"
              >
                <IonIcon :icon="iconForPath(f.path)" />
                <span class="preview-pane__item-label">{{ labelForPath(f.path) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <!-- Content (right) — renders markdown for .md, plain for others -->
      <article class="preview-pane__content">
        <header class="preview-pane__content-header">
          <span>{{ selectedFile?.path }}</span>
        </header>
        <div class="preview-pane__content-body">
          <MarkdownMessage v-if="selectedFile && selectedFile.path.endsWith('.md')" :content="selectedFile.content" />
          <pre v-else-if="selectedFile">{{ selectedFile.content }}</pre>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.preview-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--adv-surface-card, var(--ion-background-color));
  border-radius: var(--adv-radius-lg, 12px);
  border: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  overflow: hidden;
}

.preview-pane__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-lg, 24px);
  color: var(--ion-color-medium, #92949c);
  gap: 12px;
}
.preview-pane__empty-icon {
  font-size: 48px;
  opacity: 0.4;
}

.preview-pane__layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  height: 100%;
  min-height: 0;
}

@media (max-width: 640px) {
  .preview-pane__layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

.preview-pane__list {
  border-right: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  overflow-y: auto;
  padding: var(--adv-space-sm, 8px) 0;
}

@media (max-width: 640px) {
  .preview-pane__list {
    border-right: none;
    border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
    max-height: 140px;
  }
}

.preview-pane__group {
  padding: 0 var(--adv-space-sm, 8px);
}
.preview-pane__group + .preview-pane__group {
  margin-top: var(--adv-space-sm, 8px);
}
.preview-pane__group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--ion-color-medium, #92949c);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
}
.preview-pane__group-count {
  background: var(--adv-border-subtle, rgba(120, 120, 120, 0.2));
  border-radius: 6px;
  padding: 0 5px;
  font-size: 0.65rem;
}

.preview-pane__group ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.preview-pane__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 0.8rem;
  color: var(--ion-text-color, inherit);
}
.preview-pane__item:hover {
  background: color-mix(in srgb, var(--ion-color-primary) 8%, transparent);
}
.preview-pane__item.is-active {
  background: color-mix(in srgb, var(--ion-color-primary) 15%, transparent);
  color: var(--ion-color-primary);
  font-weight: 500;
}

.preview-pane__item-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.preview-pane__content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.preview-pane__content-header {
  padding: 10px 14px;
  font-size: 0.75rem;
  color: var(--ion-color-medium, #92949c);
  border-bottom: 1px solid var(--adv-border-subtle, rgba(120, 120, 120, 0.15));
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-pane__content-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--adv-space-md, 16px);
  font-size: 0.9rem;
  line-height: 1.6;
}

.preview-pane__content-body pre {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace;
  font-size: 0.85rem;
}
</style>
