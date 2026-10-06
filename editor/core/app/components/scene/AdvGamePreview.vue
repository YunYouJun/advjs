<script setup lang="ts">
import { AdvGameLoadStatusEnum } from '@advjs/client'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'

import { onUnmounted, watch } from 'vue'
import '../../../../../themes/theme-default/styles'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const desktop = import.meta.client && !!window.advDesktop
const AELoadOnlineConfigFileDialog = defineAsyncComponent(() => import('../dialogs/AELoadOnlineConfigFileDialog.vue'))

const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const pending = ref(false)
const previewError = ref('')

async function runPreviewAction(action: () => Promise<unknown>) {
  if (pending.value)
    return
  pending.value = true
  previewError.value = ''
  try {
    await action()
  }
  catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error)
  }
  finally {
    pending.value = false
  }
}

const gameStore = useGameStore()
const fileStore = useFileStore()
const projectStore = useProjectStore()
const show = computed(() => gameStore.client.loadStatus >= AdvGameLoadStatusEnum.CONFIG_LOADED)

const desktopPreviewError = ref('')
async function launchDesktopPreview() {
  try {
    await window.advDesktop?.preview()
    desktopPreviewError.value = ''
  }
  catch (failure) {
    desktopPreviewError.value = String(failure)
  }
}

async function startSourcePreview() {
  if (projectStore.project)
    await gameStore.loadGameFromConfig(projectStore.project.previewConfig)
}

proxyLog()

/**
 * File change detection
 * Periodically checks if project files have been modified (by AI or external tools)
 */
const hasFileChanges = ref(false)
let lastCheckTimestamps = new Map<string, number>()
let checkInterval: ReturnType<typeof setInterval> | null = null

async function checkForFileChanges() {
  if (projectStore.workspaceMode === 'local' || !projectStore.rootDir?.handle)
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
  await projectStore.refreshProject()
}

watch(() => [props.visible, projectStore.workspaceMode], () => {
  if (checkInterval)
    clearInterval(checkInterval)
  checkInterval = props.visible && projectStore.workspaceMode === 'browser' ? setInterval(checkForFileChanges, 5000) : null
}, { immediate: true })

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
})
</script>

<template>
  <div v-if="desktop" class="ae-resource-panel flex h-full items-center justify-center">
    <AGUIButton :disabled="!projectStore.workspace" @click="launchDesktopPreview">
      从已保存项目启动游戏预览
    </AGUIButton>
    <p v-if="desktopPreviewError" role="alert" class="ae-resource-error">
      {{ desktopPreviewError }}
    </p>
  </div>
  <template v-else>
    <div class="flex h-full w-full items-center justify-center" relative>
      <AdvGame v-if="show" class="h-full w-full" />
      <AEOpenProject v-else-if="!projectStore.project" />
      <div v-else class="preview-start">
        <AGUIButton theme="primary" :loading="pending" @click="runPreviewAction(startSourcePreview)">
          {{ zh ? '启动项目预览' : 'Start source preview' }}
        </AGUIButton>
      </div>
      <div v-if="hasFileChanges && show" class="preview-update">
        <span>{{ zh ? '项目文件已更新' : 'Project files changed' }}</span>
        <AGUIButton icon="i-ri-refresh-line" :loading="pending" @click="runPreviewAction(refreshPreview)">
          {{ zh ? '刷新预览' : 'Refresh preview' }}
        </AGUIButton>
      </div>
      <p v-if="previewError" class="preview-error" role="alert">
        {{ previewError }}
      </p>
    </div>

    <AELoadOnlineConfigFileDialog v-if="fileStore.onlineAdvConfigFileDialogOpen" />
  </template>
</template>

<style scoped>
.preview-start {
  padding: 12px;
}
.preview-update {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  max-width: calc(100% - 24px);
  padding: 4px 8px;
  border: 1px solid var(--agui-c-divider);
  background: var(--agui-c-bg-panel);
  color: var(--agui-c-text-1);
  font-size: 12px;
}
.preview-error {
  position: absolute;
  inset-inline: 12px;
  bottom: 44px;
  padding: 8px;
  background: var(--agui-c-bg-panel);
  color: var(--agui-c-danger-text);
  font-size: 12px;
  overflow-wrap: anywhere;
}
</style>
