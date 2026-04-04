<script setup lang="ts">
import type { DiffLine, FileDiff } from '../utils/lineDiff'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  diff: FileDiff
}>()

const { t } = useI18n()
const expanded = ref(true)

/** Context lines to show around changed hunks */
const CONTEXT = 3

interface VisibleLine {
  line: DiffLine
  lineNum: number
  isEllipsis?: false
}
interface EllipsisMarker {
  isEllipsis: true
  key: string
}
type DisplayItem = VisibleLine | EllipsisMarker

const displayItems = computed<DisplayItem[]>(() => {
  const lines = props.diff.lines
  const n = lines.length

  // Build a set of indices that should be visible (changed lines ± CONTEXT)
  const visible = new Set<number>()
  for (let i = 0; i < n; i++) {
    if (lines[i].type !== 'unchanged') {
      for (let k = Math.max(0, i - CONTEXT); k <= Math.min(n - 1, i + CONTEXT); k++)
        visible.add(k)
    }
  }

  // If every line is unchanged (no diff), show nothing
  if (visible.size === 0)
    return []

  const items: DisplayItem[] = []
  let prevIncluded = false

  for (let i = 0; i < n; i++) {
    if (visible.has(i)) {
      if (!prevIncluded && i > 0)
        items.push({ isEllipsis: true, key: `ellipsis-${i}` })
      items.push({ line: lines[i], lineNum: i + 1, isEllipsis: false })
      prevIncluded = true
    }
    else {
      prevIncluded = false
    }
  }

  // Trailing ellipsis
  if (visible.size > 0 && Math.max(...visible) < n - 1)
    items.push({ isEllipsis: true, key: `ellipsis-end` })

  return items
})

const isNewFile = computed(() => props.diff.before === '')
const hasChanges = computed(() => props.diff.addedCount > 0 || props.diff.removedCount > 0)

function filename(path: string): string {
  return path.split('/').pop() || path
}
</script>

<template>
  <div class="fdp">
    <!-- Header -->
    <button class="fdp__header" @click="expanded = !expanded">
      <span class="fdp__chevron" :class="{ 'fdp__chevron--collapsed': !expanded }">▶</span>
      <span class="fdp__filename">{{ filename(diff.filename) }}</span>
      <span v-if="isNewFile" class="fdp__badge fdp__badge--new">{{ t('chat.diffNewFile') }}</span>
      <span v-if="hasChanges" class="fdp__stats">
        <span v-if="diff.addedCount" class="fdp__stat fdp__stat--added">+{{ diff.addedCount }}</span>
        <span v-if="diff.removedCount" class="fdp__stat fdp__stat--removed">-{{ diff.removedCount }}</span>
      </span>
      <span v-else class="fdp__no-change">{{ t('chat.diffNoChange') }}</span>
    </button>

    <!-- Body -->
    <div v-if="expanded && hasChanges" class="fdp__body">
      <div class="fdp__lines">
        <template v-for="item in displayItems" :key="'isEllipsis' in item && item.isEllipsis ? item.key : item.lineNum">
          <div v-if="'isEllipsis' in item && item.isEllipsis" class="fdp__ellipsis">
            ···
          </div>
          <div
            v-else-if="'line' in item"
            class="fdp__line"
            :class="`fdp__line--${item.line.type}`"
          >
            <span class="fdp__sign">{{ item.line.type === 'added' ? '+' : item.line.type === 'removed' ? '-' : ' ' }}</span>
            <span class="fdp__linenum">{{ item.lineNum }}</span>
            <span class="fdp__content">{{ item.line.content }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fdp {
  margin-top: 8px;
  border: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.1));
  border-radius: var(--adv-radius-md, 8px);
  overflow: hidden;
  font-size: 12px;
}

.fdp__header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  background: var(--adv-surface-elevated, #f5f5f5);
  border: none;
  cursor: pointer;
  text-align: left;
  color: var(--adv-text-secondary, #555);
  transition: background 0.15s;
}

.fdp__header:hover {
  background: var(--adv-surface-hover, #eee);
}

:root.dark .fdp__header {
  background: var(--adv-surface-elevated, #252536);
  color: var(--adv-text-secondary, #aaa);
}

:root.dark .fdp__header:hover {
  background: rgba(255, 255, 255, 0.07);
}

.fdp__chevron {
  font-size: 8px;
  transition: transform 0.15s;
  flex-shrink: 0;
}

.fdp__chevron--collapsed {
  transform: rotate(-90deg);
}

.fdp__filename {
  font-weight: 600;
  color: var(--adv-text-primary, #222);
  font-size: 12px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:root.dark .fdp__filename {
  color: var(--adv-text-primary, #e0e0e0);
}

.fdp__badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.fdp__badge--new {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

:root.dark .fdp__badge--new {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.fdp__stats {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.fdp__stat {
  font-size: 11px;
  font-weight: 600;
  padding: 0 4px;
  border-radius: 4px;
}

.fdp__stat--added {
  color: #16a34a;
  background: rgba(34, 197, 94, 0.1);
}

.fdp__stat--removed {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.1);
}

:root.dark .fdp__stat--added {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.15);
}

:root.dark .fdp__stat--removed {
  color: #f87171;
  background: rgba(239, 68, 68, 0.15);
}

.fdp__no-change {
  font-size: 11px;
  color: var(--adv-text-tertiary, #999);
}

.fdp__body {
  border-top: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.08));
  overflow-x: auto;
}

.fdp__lines {
  display: table;
  width: 100%;
  border-collapse: collapse;
}

.fdp__line {
  display: table-row;
}

.fdp__line--added {
  background: rgba(34, 197, 94, 0.08);
}

.fdp__line--removed {
  background: rgba(239, 68, 68, 0.08);
}

:root.dark .fdp__line--added {
  background: rgba(34, 197, 94, 0.12);
}

:root.dark .fdp__line--removed {
  background: rgba(239, 68, 68, 0.12);
}

.fdp__sign,
.fdp__linenum,
.fdp__content {
  display: table-cell;
  padding: 1px 0;
  white-space: pre;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
}

.fdp__sign {
  padding: 1px 6px;
  font-weight: 700;
  user-select: none;
  min-width: 16px;
  text-align: center;
}

.fdp__line--added .fdp__sign {
  color: #16a34a;
}

.fdp__line--removed .fdp__sign {
  color: #dc2626;
}

:root.dark .fdp__line--added .fdp__sign {
  color: #4ade80;
}

:root.dark .fdp__line--removed .fdp__sign {
  color: #f87171;
}

.fdp__linenum {
  padding: 1px 8px 1px 4px;
  text-align: right;
  color: var(--adv-text-tertiary, #aaa);
  user-select: none;
  min-width: 32px;
  border-right: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
}

.fdp__content {
  padding: 1px 8px;
  color: var(--adv-text-primary, #222);
}

:root.dark .fdp__content {
  color: var(--adv-text-primary, #e0e0e0);
}

.fdp__ellipsis {
  padding: 2px 10px;
  color: var(--adv-text-tertiary, #aaa);
  background: var(--adv-surface-card, #fff);
  font-size: 12px;
  letter-spacing: 2px;
  text-align: center;
  user-select: none;
  border-top: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
  border-bottom: 1px solid var(--adv-border-subtle, rgba(0, 0, 0, 0.06));
}

:root.dark .fdp__ellipsis {
  background: var(--adv-surface-card, #1e1e2e);
}
</style>
