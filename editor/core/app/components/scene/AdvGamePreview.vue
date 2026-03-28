<script setup lang="ts">
import { AdvGameLoadStatusEnum } from '@advjs/client'

import { onMounted, onUnmounted } from 'vue'
import '../../../../../themes/theme-default/styles'

const AELoadOnlineConfigFileDialog = defineAsyncComponent(() => import('../dialogs/AELoadOnlineConfigFileDialog.vue'))

const gameStore = useGameStore()
const fileStore = useFileStore()
const projectStore = useProjectStore()
const show = computed(() => gameStore.client.loadStatus >= AdvGameLoadStatusEnum.CONFIG_LOADED)

proxyLog()

/**
 * File change detection
 * Periodically checks if project files have been modified (by AI or external tools)
 */
const hasFileChanges = ref(false)
let lastCheckTimestamps = new Map<string, number>()
let checkInterval: ReturnType<typeof setInterval> | null = null

async function checkForFileChanges() {
  if (!projectStore.rootDir?.handle)
    return

  try {
    const dirHandle = projectStore.rootDir.handle as FileSystemDirectoryHandle
    let advDir: FileSystemDirectoryHandle
    try {
      advDir = await dirHandle.getDirectoryHandle('adv')
    }
    catch {
      advDir = dirHandle
    }

    const filesToCheck = ['index.adv.json']
    const currentTimestamps = new Map<string, number>()

    for (const fileName of filesToCheck) {
      try {
        const fileHandle = await advDir.getFileHandle(fileName)
        const file = await fileHandle.getFile()
        currentTimestamps.set(fileName, file.lastModified)
      }
      catch {
        // File doesn't exist, skip
      }
    }

    // Check chapters directory
    try {
      const chaptersDir = await advDir.getDirectoryHandle('chapters')
      for await (const entry of chaptersDir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.adv.md')) {
          const file = await entry.getFile()
          currentTimestamps.set(`chapters/${entry.name}`, file.lastModified)
        }
      }
    }
    catch {
      // No chapters dir
    }

    // Compare with previous timestamps
    if (lastCheckTimestamps.size > 0) {
      for (const [name, ts] of currentTimestamps) {
        const prev = lastCheckTimestamps.get(name)
        if (prev && prev !== ts) {
          hasFileChanges.value = true
          break
        }
      }
      // Check for new files
      if (!hasFileChanges.value) {
        for (const name of currentTimestamps.keys()) {
          if (!lastCheckTimestamps.has(name)) {
            hasFileChanges.value = true
            break
          }
        }
      }
    }

    lastCheckTimestamps = currentTimestamps
  }
  catch {
    // Silently ignore errors during file checking
  }
}

async function refreshPreview() {
  hasFileChanges.value = false

  // Reload entry file if available
  if (projectStore.entryFileHandle) {
    await projectStore.setEntryFileHandle(projectStore.entryFileHandle)
  }
}

onMounted(async () => {
  // Start file change detection (check every 5 seconds)
  checkInterval = setInterval(checkForFileChanges, 5000)
})

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
})
</script>

<template>
  <div class="h-full w-full flex items-center justify-center" relative>
    <AdvGame v-if="show" class="h-full w-full" />
    <AEOpenProject v-else />

    <!-- File Changes Refresh Button -->
    <Transition name="fade">
      <button
        v-if="hasFileChanges && show"
        class="refresh-btn"
        absolute bottom-4 left="50%" z-10
        translate-x="-50%"
        flex items-center gap-1
        rounded-full bg-blue-600 px-4 py-2 text-sm text-white shadow-lg
        hover:bg-blue-700
        @click="refreshPreview"
      >
        <div i-ri-refresh-line animate-spin />
        Files changed — Click to refresh
      </button>
    </Transition>
  </div>

  <AELoadOnlineConfigFileDialog v-if="fileStore.onlineAdvConfigFileDialogOpen" />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.refresh-btn {
  animation: pulse-subtle 2s ease-in-out infinite;
}

@keyframes pulse-subtle {
  0%,
  100% {
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.1),
      0 2px 4px -2px rgb(0 0 0 / 0.1);
  }
  50% {
    box-shadow:
      0 10px 15px -3px rgb(59 130 246 / 0.3),
      0 4px 6px -4px rgb(59 130 246 / 0.2);
  }
}
</style>
