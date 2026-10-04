<script setup lang="ts">
import { computed, shallowRef } from 'vue'

const contextStore = useProjectContextStore()
const projectStore = useProjectStore()
const hasContext = computed(() => contextStore.sections.length > 0)
const isRefreshing = shallowRef(false)
const message = shallowRef('')
const error = shallowRef('')
const statistics = computed(() => [
  { label: 'Chapters', value: contextStore.stats.chapters },
  { label: 'Characters', value: contextStore.stats.characters },
  { label: 'Scenes', value: contextStore.stats.scenes },
])

async function loadFromProject(): Promise<void> {
  isRefreshing.value = true
  error.value = ''
  message.value = ''
  try {
    await projectStore.refreshProject()
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not refresh project context'
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
    message.value = 'Author context copied'
  }
  catch {
    error.value = 'Could not copy author context. Check clipboard access and try again.'
  }
}
</script>

<template>
  <div class="project-context-view" p-3>
    <p v-if="contextStore.isLoaded" class="text-xs mb-3 op-70">
      {{ projectStore.rootDir?.name }} · Saved author context
    </p>
    <div v-if="contextStore.isLoaded" class="mb-4 gap-2 grid grid-cols-3">
      <div v-for="stat in statistics" :key="stat.label" class="p-3 text-center rounded-lg bg-blue-500/10">
        <div class="text-2xl text-blue-400 font-bold">
          {{ stat.value }}
        </div>
        <div class="text-xs op-70">
          {{ stat.label }}
        </div>
      </div>
    </div>
    <div class="mb-4 flex gap-2">
      <button
        class="text-sm adv-btn text-white px-3 py-1.5 rounded bg-blue-600 flex-1 hover:bg-blue-700 disabled:op-50"
        :disabled="!contextStore.isLoaded || isRefreshing"
        @click="loadFromProject"
      >
        {{ isRefreshing ? 'Refreshing…' : 'Refresh' }}
      </button>
      <button
        v-if="hasContext"
        class="text-sm adv-btn text-white px-3 py-1.5 rounded bg-green-600 flex-1 hover:bg-green-700"
        @click="copyContextForAI"
      >
        Copy for AI
      </button>
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
        class="mb-3"
      >
        <summary class="font-bold mb-1 cursor-pointer select-none">
          {{ section.title }}
        </summary>
        <pre class="context-block text-xs p-2 rounded bg-gray-100 dark:bg-gray-800">{{ section.content }}</pre>
      </details>
    </template>
    <div v-else class="text-sm py-8 text-center op-50">
      {{ contextStore.isLoaded ? 'This project has no author context yet.' : 'Open a project to view context' }}
    </div>
  </div>
</template>

<style scoped>
.context-block {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow: auto;
  font-family: ui-monospace, monospace;
  line-height: 1.5;
}
</style>
