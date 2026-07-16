<script setup lang="ts">
import type { CompileDiagnostic } from '@advjs/core'
import type { ChapterInfo } from '../composables/useProjectContent'
import type { StudioGameSettings } from '../utils/projectRuntimeFiles'
import type { RuntimeAuthoringResult, RuntimeProgramRow } from '../utils/runtimeAuthoring'
import { computed, onBeforeUnmount, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { compileRuntimeAuthoringProject } from '../utils/runtimeAuthoring'
import AdvPreviewPanel from './AdvPreviewPanel.vue'

const props = defineProps<{
  content: string
  file: string
  chapters: ChapterInfo[]
  settings: StudioGameSettings
}>()

const emit = defineEmits<{
  selectSource: [file: string, line: number, column: number]
}>()

type Tab = 'preview' | 'program' | 'diagnostics'
const { t } = useI18n()
const currentTab = shallowRef<Tab>('preview')
const compiling = shallowRef(false)
const result = shallowRef<RuntimeAuthoringResult>({ rows: [], diagnostics: [] })
let compileTimer: ReturnType<typeof setTimeout> | undefined
let compileToken = 0

const tabs = computed<Array<{ id: Tab, label: string, count?: number }>>(() => [
  { id: 'preview', label: t('runtimeAuthoring.preview') },
  { id: 'program', label: t('runtimeAuthoring.program'), count: result.value.rows.length },
  { id: 'diagnostics', label: t('runtimeAuthoring.diagnostics'), count: result.value.diagnostics.length },
])
const programGroups = computed(() => {
  const groups = new Map<string, RuntimeProgramRow[]>()
  for (const row of result.value.rows) {
    const rows = groups.get(row.chapterId) ?? []
    rows.push(row)
    groups.set(row.chapterId, rows)
  }
  return [...groups.entries()].map(([chapterId, rows]) => ({ chapterId, rows }))
})

function scheduleCompile() {
  const token = ++compileToken
  clearTimeout(compileTimer)
  compiling.value = true
  compileTimer = setTimeout(async () => {
    const compiled = await compileRuntimeAuthoringProject(
      props.chapters,
      props.settings,
      { file: props.file, content: props.content },
    )
    if (token !== compileToken)
      return
    result.value = compiled
    compiling.value = false
  }, 300)
}

function selectDiagnostic(diagnostic: CompileDiagnostic) {
  emit(
    'selectSource',
    diagnostic.source?.file ?? props.file,
    diagnostic.source?.line ?? 1,
    diagnostic.source?.column ?? 1,
  )
}

function address(row: RuntimeProgramRow): string {
  return `${row.chapterId}#${row.nodeId}`
}

function nextAddress(row: RuntimeProgramRow): string {
  return row.next ? `${row.next.chapterId}#${row.next.nodeId}` : '—'
}

watch(
  [() => props.content, () => props.file, () => props.chapters, () => props.settings],
  scheduleCompile,
  { deep: true, immediate: true },
)

onBeforeUnmount(() => {
  compileToken += 1
  clearTimeout(compileTimer)
})
</script>

<template>
  <section class="runtime-authoring-panel">
    <div role="tablist" :aria-label="t('runtimeAuthoring.tabsLabel')" class="runtime-authoring-panel__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :data-authoring-tab="tab.id"
        :aria-selected="currentTab === tab.id"
        @click="currentTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.count">{{ tab.count }}</span>
      </button>
      <small v-if="compiling">{{ t('runtimeAuthoring.compiling') }}</small>
    </div>

    <div class="runtime-authoring-panel__content">
      <AdvPreviewPanel v-if="currentTab === 'preview'" :content="content" />

      <div v-else-if="currentTab === 'program'" class="runtime-authoring-panel__program">
        <p v-if="programGroups.length === 0" class="runtime-authoring-panel__empty">
          {{ t('runtimeAuthoring.noProgram') }}
        </p>
        <section
          v-for="group in programGroups"
          v-else
          :key="group.chapterId"
          class="runtime-authoring-panel__chapter"
        >
          <h3>{{ group.chapterId }}</h3>
          <button
            v-for="row in group.rows"
            :key="address(row)"
            type="button"
            :class="{ 'runtime-authoring-panel__row--current': row.source?.file === file }"
            @click="emit('selectSource', row.source?.file ?? file, row.source?.line ?? 1, row.source?.column ?? 1)"
          >
            <code>{{ row.nodeId }}</code>
            <span>{{ row.kind }}</span>
            <small>{{ nextAddress(row) }}</small>
          </button>
        </section>
      </div>

      <div v-else class="runtime-authoring-panel__diagnostics">
        <p v-if="result.diagnostics.length === 0" class="runtime-authoring-panel__empty">
          {{ t('runtimeAuthoring.noDiagnostics') }}
        </p>
        <button
          v-for="diagnostic in result.diagnostics"
          v-else
          :key="`${diagnostic.code}:${diagnostic.source?.file}:${diagnostic.source?.line}:${diagnostic.message}`"
          type="button"
          data-runtime-diagnostic
          :class="`runtime-authoring-panel__diagnostic--${diagnostic.severity}`"
          @click="selectDiagnostic(diagnostic)"
        >
          <span>
            <code>{{ diagnostic.code }}</code>
            <small>{{ diagnostic.source?.file ?? t('runtimeAuthoring.sourceUnknown') }}<template v-if="diagnostic.source?.line">:{{ diagnostic.source.line }}<template v-if="diagnostic.source.column">:{{ diagnostic.source.column }}</template></template></small>
          </span>
          <strong>{{ diagnostic.message }}</strong>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.runtime-authoring-panel {
  display: flex;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  border-left: 1px solid var(--adv-border-subtle);
  background: var(--ion-background-color, #fff);
}

.runtime-authoring-panel__tabs {
  display: flex;
  min-height: 45px;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--adv-border-subtle);
  overflow-x: auto;
}

.runtime-authoring-panel__tabs button {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.65rem;
  border: 0;
  border-radius: var(--adv-radius-sm);
  background: transparent;
  color: var(--adv-text-secondary);
  cursor: pointer;
}

.runtime-authoring-panel__tabs button[aria-selected='true'] {
  background: rgb(99 102 241 / 12%);
  color: var(--ion-color-primary);
}

.runtime-authoring-panel__tabs button span {
  min-width: 1.15rem;
  padding: 0.05rem 0.3rem;
  border-radius: 999px;
  background: rgb(99 102 241 / 16%);
  font-size: 0.7rem;
}

.runtime-authoring-panel__tabs small {
  margin-left: auto;
  color: var(--adv-text-tertiary);
}

.runtime-authoring-panel__content {
  min-height: 0;
  flex: 1;
  overflow: auto;
}

.runtime-authoring-panel__program,
.runtime-authoring-panel__diagnostics {
  display: grid;
  gap: 0.75rem;
  padding: 0.75rem;
}

.runtime-authoring-panel__chapter h3 {
  margin: 0 0 0.35rem;
  color: var(--adv-text-secondary);
  font:
    600 0.75rem/1.4 'SF Mono',
    monospace;
}

.runtime-authoring-panel__chapter button,
.runtime-authoring-panel__diagnostics button {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(7rem, 1fr) minmax(5rem, 0.6fr) minmax(8rem, 1fr);
  gap: 0.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  color: var(--adv-text-primary);
  text-align: left;
  cursor: pointer;
}

.runtime-authoring-panel__chapter button + button {
  border-top: 0;
}

.runtime-authoring-panel__row--current {
  border-left: 3px solid var(--ion-color-primary) !important;
}

.runtime-authoring-panel__diagnostics button {
  grid-template-columns: 1fr;
  border-left: 3px solid var(--ion-color-danger);
  border-radius: var(--adv-radius-sm);
}

.runtime-authoring-panel__diagnostics button > span {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  color: var(--adv-text-secondary);
}

.runtime-authoring-panel__diagnostic--warning {
  border-left-color: var(--ion-color-warning) !important;
}

.runtime-authoring-panel__empty {
  margin: auto;
  padding: 2rem;
  color: var(--adv-text-tertiary);
  text-align: center;
}
</style>
