<script setup lang="ts">
const contextStore = useProjectContextStore()
const projectStore = useProjectStore()

const hasContext = computed(() => contextStore.isLoaded && (
  contextStore.worldContent
  || contextStore.outlineContent
  || contextStore.chaptersReadme
  || contextStore.charsReadme
  || contextStore.scenesReadme
))

/**
 * Load context from current project directory
 */
async function loadFromProject() {
  const rootDir = projectStore.rootDir
  if (rootDir?.handle) {
    await contextStore.loadContext(rootDir.handle as FileSystemDirectoryHandle)
  }
}

/**
 * Copy merged context to clipboard for AI usage
 */
async function copyContextForAI() {
  const context = contextStore.getMergedContext()
  await navigator.clipboard.writeText(context)
}

onMounted(() => {
  if (!contextStore.isLoaded && projectStore.rootDir?.handle) {
    loadFromProject()
  }
})
</script>

<template>
  <div class="project-context-view" p-3>
    <!-- Stats Cards -->
    <div v-if="hasContext" class="stats-grid" grid grid-cols-3 mb-4 gap-2>
      <div class="stat-card" rounded-lg bg-blue-500:10 p-3 text-center>
        <div text-2xl text-blue font-bold>
          {{ contextStore.stats.chapters }}
        </div>
        <div text-xs op-70>
          Chapters
        </div>
      </div>
      <div class="stat-card" rounded-lg bg-green-500:10 p-3 text-center>
        <div text-2xl text-green font-bold>
          {{ contextStore.stats.characters }}
        </div>
        <div text-xs op-70>
          Characters
        </div>
      </div>
      <div class="stat-card" rounded-lg bg-purple-500:10 p-3 text-center>
        <div text-2xl text-purple font-bold>
          {{ contextStore.stats.scenes }}
        </div>
        <div text-xs op-70>
          Scenes
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div mb-4 flex gap-2>
      <button
        class="btn" flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white
        hover:bg-blue-700
        @click="loadFromProject"
      >
        <div i-ri-refresh-line mr-1 inline-block />
        Refresh
      </button>
      <button
        v-if="hasContext"
        class="btn" flex-1 rounded bg-green-600 px-3 py-1.5 text-sm text-white
        hover:bg-green-700
        @click="copyContextForAI"
      >
        <div i-ri-clipboard-line mr-1 inline-block />
        Copy for AI
      </button>
    </div>

    <template v-if="hasContext">
      <!-- World -->
      <details v-if="contextStore.worldContent" open mb-3>
        <summary class="cursor-pointer select-none font-bold" mb-1>
          <div i-ri-earth-line mr-1 inline-block />
          World
        </summary>
        <pre class="context-block" overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800>{{ contextStore.worldContent }}</pre>
      </details>

      <!-- Outline -->
      <details v-if="contextStore.outlineContent" open mb-3>
        <summary class="cursor-pointer select-none font-bold" mb-1>
          <div i-ri-file-list-3-line mr-1 inline-block />
          Outline
        </summary>
        <pre class="context-block" overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800>{{ contextStore.outlineContent }}</pre>
      </details>

      <!-- Chapters README -->
      <details v-if="contextStore.chaptersReadme" mb-3>
        <summary class="cursor-pointer select-none font-bold" mb-1>
          <div i-ri-book-open-line mr-1 inline-block />
          Chapters
        </summary>
        <pre class="context-block" overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800>{{ contextStore.chaptersReadme }}</pre>
      </details>

      <!-- Characters README -->
      <details v-if="contextStore.charsReadme" mb-3>
        <summary class="cursor-pointer select-none font-bold" mb-1>
          <div i-ri-user-line mr-1 inline-block />
          Characters
        </summary>
        <pre class="context-block" overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800>{{ contextStore.charsReadme }}</pre>
      </details>

      <!-- Scenes README -->
      <details v-if="contextStore.scenesReadme" mb-3>
        <summary class="cursor-pointer select-none font-bold" mb-1>
          <div i-ri-landscape-line mr-1 inline-block />
          Scenes
        </summary>
        <pre class="context-block" overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800>{{ contextStore.scenesReadme }}</pre>
      </details>

      <!-- Glossary -->
      <details v-if="contextStore.glossaryContent" mb-3>
        <summary class="cursor-pointer select-none font-bold" mb-1>
          <div i-ri-book-2-line mr-1 inline-block />
          Glossary
        </summary>
        <pre class="context-block" overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800>{{ contextStore.glossaryContent }}</pre>
      </details>
    </template>

    <!-- Empty State -->
    <div v-else flex flex-col items-center justify-center py-8 op-50>
      <div i-ri-folder-open-line mb-2 text-4xl />
      <p text-sm>
        Open a project to view context
      </p>
      <p text-xs op-70>
        Reads world.md, outline.md, and README files from adv/ directory
      </p>
    </div>
  </div>
</template>

<style scoped>
.context-block {
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  font-family: ui-monospace, monospace;
  line-height: 1.5;
}
</style>
