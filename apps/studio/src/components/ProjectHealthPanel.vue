<script setup lang="ts">
import type { ValidationIssue, ValidationResult } from '../utils/projectValidation'
import { IonIcon } from '@ionic/vue'
import {
  alertCircleOutline,
  buildOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  warningOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps<{
  result: ValidationResult
}>()

const emit = defineEmits<{
  /** Emitted after one or more issues are auto-fixed; parent should re-validate */
  (e: 'fixed', dismissed: ValidationIssue[]): void
}>()

const { t } = useI18n()
const router = useRouter()

/** Issues that have been dismissed / fixed in this session */
const dismissedKeys = ref(new Set<string>())
const fixingKeys = ref(new Set<string>())

function issueKey(issue: ValidationIssue): string {
  return `${issue.category}:${issue.file}:${issue.message}`
}

const groupedIssues = computed(() => {
  const groups = new Map<string, ValidationIssue[]>()
  for (const issue of props.result.issues) {
    if (dismissedKeys.value.has(issueKey(issue)))
      continue
    const list = groups.get(issue.category) || []
    list.push(issue)
    groups.set(issue.category, list)
  }
  return groups
})

/**
 * Determine whether an issue can be auto-dismissed (warning-level broken references).
 * We support "quick fix" for warning-type issues in character/scene/audio/location
 * categories — these are typically broken cross-references that can be safely ignored.
 */
function isFixable(issue: ValidationIssue): boolean {
  return issue.type === 'warning'
    && ['character', 'scene', 'audio', 'location'].includes(issue.category)
}

const categoryLabels: Record<string, string> = {
  syntax: 'Syntax',
  character: 'Characters',
  scene: 'Scenes',
  audio: 'Audio',
  location: 'Locations',
}

const categoryIcons: Record<string, string> = {
  syntax: alertCircleOutline,
  character: alertCircleOutline,
  scene: warningOutline,
  audio: warningOutline,
  location: warningOutline,
}

function jumpToIssue(issue: ValidationIssue) {
  switch (issue.category) {
    case 'syntax':
      router.push(`/editor?file=${encodeURIComponent(issue.file)}`)
      break
    case 'character':
      router.push('/tabs/workspace/characters')
      break
    case 'scene':
      router.push('/tabs/workspace/scenes')
      break
    case 'audio':
      router.push('/tabs/workspace/audio')
      break
    case 'location':
      router.push('/tabs/workspace/locations')
      break
  }
}

/**
 * Dismiss a single warning issue (mark as acknowledged).
 */
function dismissIssue(issue: ValidationIssue) {
  const key = issueKey(issue)
  fixingKeys.value.add(key)
  // Brief animation delay then dismiss
  setTimeout(() => {
    fixingKeys.value.delete(key)
    dismissedKeys.value.add(key)
    emit('fixed', [issue])
  }, 300)
}

/**
 * Dismiss all fixable (warning) issues in a category at once.
 */
function dismissCategory(category: string) {
  const issues = props.result.issues.filter(
    i => i.category === category && isFixable(i) && !dismissedKeys.value.has(issueKey(i)),
  )
  const fixed: ValidationIssue[] = []
  for (const issue of issues) {
    const key = issueKey(issue)
    fixingKeys.value.add(key)
    fixed.push(issue)
  }
  setTimeout(() => {
    for (const issue of fixed) {
      const key = issueKey(issue)
      fixingKeys.value.delete(key)
      dismissedKeys.value.add(key)
    }
    emit('fixed', fixed)
  }, 300)
}

function hasCategoryFixable(issues: ValidationIssue[]): boolean {
  return issues.some(i => isFixable(i) && !dismissedKeys.value.has(issueKey(i)))
}
</script>

<template>
  <div class="health-panel">
    <!-- Passed state -->
    <div v-if="result.passed" class="health-panel__passed">
      <IonIcon :icon="checkmarkCircleOutline" class="health-panel__passed-icon" />
      <span>{{ t('projectHealth.noIssues') }}</span>
    </div>

    <!-- Issues grouped by category -->
    <template v-else>
      <div
        v-for="[category, issues] in groupedIssues"
        :key="category"
        class="health-group"
      >
        <div class="health-group__header">
          <IonIcon :icon="categoryIcons[category] || warningOutline" class="health-group__icon" :class="{ 'health-group__icon--error': issues.some(i => i.type === 'error') }" />
          <span class="health-group__label">{{ categoryLabels[category] || category }}</span>
          <span class="health-group__badge">{{ issues.length }}</span>
          <button
            v-if="hasCategoryFixable(issues)"
            class="health-group__fix-all"
            :title="t('projectHealth.dismissAll')"
            @click.stop="dismissCategory(category)"
          >
            <IonIcon :icon="buildOutline" />
            <span>{{ t('projectHealth.dismissAll') }}</span>
          </button>
        </div>
        <button
          v-for="(issue, idx) in issues.slice(0, 5)"
          :key="idx"
          class="health-issue"
          :class="{
            'health-issue--error': issue.type === 'error',
            'health-issue--fixing': fixingKeys.has(issueKey(issue)),
          }"
          @click="jumpToIssue(issue)"
        >
          <div class="health-issue__body">
            <span class="health-issue__file">{{ issue.file }}</span>
            <span class="health-issue__msg">{{ issue.message }}</span>
          </div>
          <button
            v-if="isFixable(issue)"
            class="health-issue__dismiss"
            :title="t('projectHealth.dismiss')"
            @click.stop="dismissIssue(issue)"
          >
            <IonIcon :icon="checkmarkCircleOutline" />
          </button>
          <IonIcon v-else :icon="chevronForwardOutline" class="health-issue__arrow" />
        </button>
        <span v-if="issues.length > 5" class="health-group__more">
          +{{ issues.length - 5 }} {{ t('projectHealth.moreIssues') }}
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.health-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.health-panel__passed {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.08);
  color: #10b981;
  font-size: 14px;
  font-weight: 500;
}

.health-panel__passed-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.health-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.health-group__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.health-group__icon {
  font-size: 16px;
  color: #f59e0b;
  flex-shrink: 0;
}

.health-group__icon--error {
  color: #ef4444;
}

.health-group__label {
  font-size: 12px;
  font-weight: 700;
  color: var(--adv-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.health-group__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  font-size: 11px;
  font-weight: 700;
}

.health-group__fix-all {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid rgba(16, 185, 129, 0.3);
  background: rgba(16, 185, 129, 0.06);
  color: #10b981;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.health-group__fix-all ion-icon {
  font-size: 13px;
}

.health-group__fix-all:hover {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.5);
}

.health-group__fix-all:active {
  transform: scale(0.95);
}

.health-issue {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  cursor: pointer;
  text-align: left;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    opacity 0.3s ease,
    transform 0.3s ease;
}

.health-issue--fixing {
  opacity: 0.3;
  transform: translateX(20px);
  pointer-events: none;
}

.health-issue:hover {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.03);
}

.health-issue--error:hover {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.03);
}

.health-issue__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.health-issue__file {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.health-issue__msg {
  font-size: 13px;
  color: var(--adv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.health-issue__arrow {
  font-size: 14px;
  color: var(--adv-text-tertiary);
  flex-shrink: 0;
  opacity: 0.4;
}

.health-issue:hover .health-issue__arrow {
  opacity: 0.8;
}

.health-issue__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid rgba(16, 185, 129, 0.2);
  background: rgba(16, 185, 129, 0.06);
  color: #10b981;
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.health-issue__dismiss:hover {
  background: rgba(16, 185, 129, 0.15);
  border-color: rgba(16, 185, 129, 0.4);
  transform: scale(1.1);
}

.health-issue__dismiss:active {
  transform: scale(0.9);
}

.health-group__more {
  font-size: 11px;
  color: var(--adv-text-tertiary);
  padding-left: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .health-issue,
  .health-issue__dismiss,
  .health-group__fix-all {
    transition: none;
  }
}
</style>
