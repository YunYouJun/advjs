<script setup lang="ts">
import { computed, shallowRef } from 'vue'

const { t } = useI18n()
const contextStore = useProjectContextStore()
const projectStore = useProjectStore()
const hasContext = computed(() => contextStore.sections.length > 0)
const isRefreshing = shallowRef(false)
const message = shallowRef('')
const error = shallowRef('')
const statistics = computed(() => [
  { label: t('workspace.chapters'), value: contextStore.stats.chapters },
  { label: t('panels.characters'), value: contextStore.stats.characters },
  { label: t('workspace.scenes'), value: contextStore.stats.scenes },
])

async function loadFromProject(): Promise<void> {
  isRefreshing.value = true
  error.value = ''
  message.value = ''
  try {
    await projectStore.refreshProject()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : t('workspace.refreshFailed')
  }
  finally {
    isRefreshing.value = false
  }
}

async function copyContextForAI(): Promise<void> {
  error.value = ''
  message.value = ''
  try {
    await navigator.clipboard.writeText(contextStore.getMergedContext())
    message.value = t('workspace.contextCopied')
  }
  catch {
    error.value = t('workspace.copyFailed')
  }
}
</script>

<template>
  <div class="project-context-view">
    <p v-if="contextStore.isLoaded" class="context-heading">
      {{ projectStore.rootDir?.name }} · {{ $t('workspace.savedContext') }}
    </p>
    <dl v-if="contextStore.isLoaded" class="context-statistics">
      <div v-for="stat in statistics" :key="stat.label">
        <dt>{{ stat.label }}</dt><dd>{{ stat.value }}</dd>
      </div>
    </dl>
    <div class="context-actions">
      <AGUIButton
        size="mini"
        :disabled="!contextStore.isLoaded || isRefreshing"
        @click="loadFromProject"
      >
        {{ $t(isRefreshing ? 'workspace.refreshing' : 'common.refresh') }}
      </AGUIButton>
      <AGUIButton
        v-if="hasContext"
        size="mini"
        @click="copyContextForAI"
      >
        {{ $t('workspace.copyForAI') }}
      </AGUIButton>
    </div>
    <p v-if="error" role="alert" class="text-sm text-red-400 mb-3">
      {{ error }}
    </p>
    <p v-if="message" role="status" class="text-xs text-green-400 mb-3">
      {{ message }}
    </p>
    <template v-if="hasContext">
      <details
        v-for="section in contextStore.sections"
        :key="section.title"
        :open="section.title === 'World' || section.title === 'Outline'"
        class="context-section"
      >
        <summary class="context-section-heading">
          {{ $t(`workspace.sections.${section.title.toLowerCase().replaceAll(' ', '_')}`) }}
        </summary>
        <pre class="context-block">{{ section.content }}</pre>
      </details>
    </template>
    <div v-else class="text-sm py-8 text-center op-50">
      {{ $t(contextStore.isLoaded ? 'workspace.emptyContext' : 'workspace.openContext') }}
    </div>
  </div>
</template>

<style scoped>
.project-context-view {
  padding: 10px;
  color: var(--agui-c-text);
  background: var(--agui-c-bg-panel);
}
.context-heading {
  margin: 0 0 8px;
  color: var(--agui-c-text-2);
  font-size: 11px;
}
.context-statistics {
  display: flex;
  gap: 16px;
  margin: 0 0 10px;
  font-size: 11px;
}
.context-statistics > div {
  display: flex;
  gap: 5px;
}
.context-statistics dt {
  color: var(--agui-c-text-2);
}
.context-statistics dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.context-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.context-section {
  border-top: 1px solid var(--agui-c-divider-light);
}
.context-section-heading {
  padding: 7px 2px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
}
.context-section-heading:hover {
  background: var(--agui-c-bg-hover);
}
.context-section-heading:focus-visible {
  outline: 1px solid var(--agui-c-focus);
}
.context-block {
  margin: 0 0 8px;
  padding: 8px;
  font-size: 11px;
  color: var(--agui-c-text-2);
  background: var(--agui-c-bg-soft);
  border: 1px solid var(--agui-c-divider-light);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow: auto;
  font-family: ui-monospace, monospace;
  line-height: 1.5;
}
</style>
