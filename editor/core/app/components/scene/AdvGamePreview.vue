<script setup lang="ts">
import { AdvGameLoadStatusEnum } from '@advjs/client'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { usePreviewFileChanges } from '../../composables/usePreviewFileChanges'
import { useEditorLayoutState } from '../../extensions/layout-state'
import AECopyErrorButton from '../error/AECopyErrorButton.vue'
import '../../../../../themes/theme-default/styles'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const desktop = import.meta.client && !!window.advDesktop
const AELoadOnlineConfigFileDialog = defineAsyncComponent(() => import('../dialogs/AELoadOnlineConfigFileDialog.vue'))

const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const pending = ref(false)
const previewError = ref('')
const previewErrorDetails = shallowRef<unknown>()

async function runPreviewAction(action: () => Promise<unknown>) {
  if (pending.value)
    return
  pending.value = true
  previewError.value = ''
  previewErrorDetails.value = undefined
  try {
    await action()
  }
  catch (error) {
    previewError.value = error instanceof Error ? error.message : String(error)
    previewErrorDetails.value = error
  }
  finally {
    pending.value = false
  }
}

const gameStore = useGameStore()
const fileStore = useFileStore()
const projectStore = useProjectStore()
const layout = useEditorLayoutState()
const show = computed(() => gameStore.client.loadStatus >= AdvGameLoadStatusEnum.CONFIG_LOADED)
const empty = computed(() => !projectStore.project && (desktop || !show.value))

async function showProjectPanel() {
  if (document.fullscreenElement)
    await document.exitFullscreen()
  layout.select('navigation', 'advjs.core/project')
  await nextTick()
  document.querySelector<HTMLElement>('[data-editor-region="navigation"] [role="tab"][data-state="active"]')?.focus()
}

async function startSourcePreview() {
  if (projectStore.project)
    await gameStore.loadGameFromConfig(projectStore.project.previewConfig)
}

proxyLog()

const { hasFileChanges } = usePreviewFileChanges({
  visible: () => props.visible,
  directory: () => projectStore.workspaceMode === 'browser' ? projectStore.rootDir?.handle as FileSystemDirectoryHandle | undefined : undefined,
})

async function refreshPreview() {
  hasFileChanges.value = false
  await projectStore.refreshProject()
}
</script>

<template>
  <section v-if="empty" class="preview-empty" :aria-label="zh ? '游戏预览' : 'Game preview'">
    <div class="preview-empty-content">
      <span class="i-ri-gamepad-line preview-empty-icon" aria-hidden="true" />
      <h2>{{ zh ? '暂无可预览的游戏' : 'No game to preview' }}</h2>
      <p>{{ zh ? '请先在「项目」面板创建或打开项目。' : 'Create or open a project in the Project panel.' }}</p>
      <AGUIButton icon="i-ri-folder-open-line" @click="showProjectPanel">
        {{ zh ? '前往项目' : 'Go to Project' }}
      </AGUIButton>
    </div>
  </section>
  <AEDesktopGamePreview v-else-if="desktop" :visible="visible" />
  <template v-else>
    <div class="flex h-full w-full items-center justify-center" relative>
      <AdvGame v-if="show" class="h-full w-full" />
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
      <div v-if="previewError" class="preview-error" role="alert">
        <p>{{ previewError }}</p>
        <AECopyErrorButton source="Game preview" :error="previewErrorDetails ?? previewError" />
      </div>
    </div>
  </template>
  <AELoadOnlineConfigFileDialog v-if="!desktop && fileStore.onlineAdvConfigFileDialogOpen" />
</template>

<style scoped>
.preview-empty {
  display: flex;
  height: 100%;
  min-height: 0;
  padding: 16px;
  overflow: auto;
  color: var(--agui-c-text-1);
}
.preview-empty-content {
  max-width: 320px;
  margin: auto;
  text-align: center;
}
.preview-empty-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
  color: var(--agui-c-text-2);
}
.preview-empty-content h2 {
  margin: 8px 0 4px;
  font-size: 13px;
  font-weight: 600;
}
.preview-empty-content p {
  margin: 0 0 12px;
  color: var(--agui-c-text-2);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
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
