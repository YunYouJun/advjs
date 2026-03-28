<script setup lang="ts">
const contextStore = useProjectContextStore()

/**
 * Parse a markdown table row into cells
 */
function parseTableRow(line: string): string[] {
  if (!line.includes('|'))
    return []
  return line.split('|').map(cell => cell.trim()).filter(Boolean)
}

/**
 * Parse chapter statuses from chapters README
 * Looks for ✅ (completed), 📝 (draft), ⏳ (pending) markers
 */
const chapterStatuses = computed(() => {
  const readme = contextStore.chaptersReadme
  if (!readme)
    return []

  const lines = readme.split('\n')
  const statuses: { name: string, status: 'completed' | 'draft' | 'pending' }[] = []

  for (const line of lines) {
    if (line.includes('✅') || line.includes('📝') || line.includes('⏳')) {
      let status: 'completed' | 'draft' | 'pending' = 'pending'
      if (line.includes('✅'))
        status = 'completed'
      else if (line.includes('📝'))
        status = 'draft'

      // Extract name from table row or just use trimmed line
      const cells = parseTableRow(line)
      const name = cells[0] || line.trim().slice(0, 30)

      statuses.push({ name: name.trim(), status })
    }
  }

  return statuses
})

const completionRate = computed(() => {
  if (chapterStatuses.value.length === 0)
    return 0
  const completed = chapterStatuses.value.filter(c => c.status === 'completed').length
  return Math.round((completed / chapterStatuses.value.length) * 100)
})

/**
 * Parse character entries from characters README
 */
const characterEntries = computed(() => {
  const readme = contextStore.charsReadme
  if (!readme)
    return []

  const lines = readme.split('\n')
  const chars: { name: string, role: string, description: string }[] = []

  for (const line of lines) {
    const cells = parseTableRow(line)
    // Expect: Name | File | Role | Description (4+ cells)
    if (cells.length >= 4 && !cells[0].includes('---') && !cells[0].includes('角色') && !cells[0].includes('Name')) {
      chars.push({
        name: cells[0],
        role: cells[2],
        description: cells[3],
      })
    }
  }

  return chars
})

/**
 * Copy merged context for AI
 */
async function copyContextForAI() {
  const context = contextStore.getMergedContext()
  await navigator.clipboard.writeText(context)
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-500',
  draft: 'bg-yellow-500',
  pending: 'bg-gray-400',
}

const statusIcons: Record<string, string> = {
  completed: 'i-ri-check-line',
  draft: 'i-ri-edit-line',
  pending: 'i-ri-time-line',
}
</script>

<template>
  <div class="ai-dashboard-view" overflow-auto p-3>
    <!-- Header -->
    <div mb-4 flex items-center justify-between>
      <h3 m-0 text-sm font-bold>
        <div i-ri-dashboard-line mr-1 inline-block />
        AI Dashboard
      </h3>
      <button
        rounded bg-green-600 px-2 py-1 text-xs text-white
        hover:bg-green-700
        @click="copyContextForAI"
      >
        <div i-ri-clipboard-line mr-1 inline-block />
        Copy Context for AI
      </button>
    </div>

    <template v-if="contextStore.isLoaded">
      <!-- Chapter Progress -->
      <div mb-4>
        <div mb-2 flex items-center justify-between>
          <span text-xs font-bold>Chapter Progress</span>
          <span text-xs op-70>{{ completionRate }}% complete</span>
        </div>

        <!-- Progress Bar -->
        <div mb-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700>
          <div
            class="h-full rounded-full bg-green-500 transition-all"
            :style="{ width: `${completionRate}%` }"
          />
        </div>

        <!-- Chapter List -->
        <div v-if="chapterStatuses.length" class="chapter-list" flex flex-col gap-1>
          <div
            v-for="chapter in chapterStatuses"
            :key="chapter.name"
            flex items-center gap-2 rounded bg-gray-50 px-2 py-1 text-xs dark:bg-gray-800
          >
            <div
              class="size-2 shrink-0 rounded-full"
              :class="statusColors[chapter.status]"
            />
            <div :class="statusIcons[chapter.status]" text-xs op-60 />
            <span flex-1 truncate>{{ chapter.name }}</span>
            <span op-50>{{ chapter.status }}</span>
          </div>
        </div>
        <div v-else text-xs op-50>
          No chapter data found in chapters/README.md
        </div>
      </div>

      <!-- Character Cards -->
      <div mb-4>
        <div mb-2 text-xs font-bold>
          Characters ({{ contextStore.stats.characters }})
        </div>
        <div v-if="characterEntries.length" grid grid-cols-2 gap-2>
          <div
            v-for="char in characterEntries"
            :key="char.name"
            rounded-lg bg-gray-50 p-2 dark:bg-gray-800
          >
            <div flex items-center gap-1>
              <div i-ri-user-3-line text-xs text-blue />
              <span text-xs font-bold>{{ char.name }}</span>
            </div>
            <div text-xs op-60>
              {{ char.role }}
            </div>
            <div line-clamp-2 mt-1 text-xs op-40>
              {{ char.description }}
            </div>
          </div>
        </div>
        <div v-else text-xs op-50>
          No character data found in characters/README.md
        </div>
      </div>

      <!-- Scene Coverage -->
      <div mb-4>
        <div mb-2 text-xs font-bold>
          Scenes ({{ contextStore.stats.scenes }})
        </div>
        <div flex flex-wrap gap-2>
          <div
            v-for="n in contextStore.stats.scenes"
            :key="n"
            rounded bg-purple-500:15 px-2 py-1 text-xs text-purple
          >
            <div i-ri-landscape-line mr-1 inline-block />
            Scene {{ n }}
          </div>
        </div>
        <div v-if="contextStore.stats.scenes === 0" text-xs op-50>
          No scene files found
        </div>
      </div>

      <!-- Quick Stats -->
      <div rounded-lg bg-gray-50 p-3 dark:bg-gray-800>
        <div mb-2 text-xs font-bold>
          Quick Stats
        </div>
        <div grid grid-cols-2 gap-2 text-xs>
          <div flex items-center gap-1>
            <div i-ri-book-open-line text-blue />
            <span>{{ contextStore.stats.chapters }} chapters</span>
          </div>
          <div flex items-center gap-1>
            <div i-ri-user-line text-green />
            <span>{{ contextStore.stats.characters }} characters</span>
          </div>
          <div flex items-center gap-1>
            <div i-ri-landscape-line text-purple />
            <span>{{ contextStore.stats.scenes }} scenes</span>
          </div>
          <div flex items-center gap-1>
            <div i-ri-file-text-line text-orange />
            <span>{{ contextStore.worldContent ? 'Has' : 'No' }} world.md</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else flex flex-col items-center justify-center py-8 op-50>
      <div i-ri-dashboard-line mb-2 text-4xl />
      <p text-sm>
        Open a project to view dashboard
      </p>
      <p text-xs op-70>
        Dashboard shows chapter progress, character info, and scene coverage
      </p>
    </div>
  </div>
</template>
