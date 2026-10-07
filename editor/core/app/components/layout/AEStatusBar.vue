<script setup lang="ts">
import { useDesktopStore } from '../../stores/useDesktopStore'
import AECopyErrorButton from '../error/AECopyErrorButton.vue'

const desktop = useDesktopStore()
const file = useFileStore()
const monaco = useMonacoStore()
const drafts = useProjectDrafts()
const console = useConsoleStore()
const host = window.advDesktop!
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const dirty = computed(() => drafts.dirty || file.isDirty)
const task = computed(() => desktop.status.task)
const position = computed(() => monaco.positions[file.openedFilePath])
const taskLabel = computed(() => {
  if (!task.value)
    return ''
  if (task.value.kind === 'live' && task.value.state === 'succeeded')
    return desktop.status.preview?.active ? (zh.value ? `实时预览 · ${desktop.status.preview.updating ? '更新中' : '运行中'}` : `Live preview · ${desktop.status.preview.updating ? 'Updating' : 'Running'}`) : (zh.value ? '实时预览 · 已停止' : 'Live preview · Stopped')
  const kinds: Record<string, string> = zh.value ? { live: '实时预览', preview: '构建预览', directory: '导出 Web', zip: '导出 ZIP' } : { live: 'Live preview', preview: 'Build preview', directory: 'Export Web', zip: 'Export ZIP' }
  const states = zh.value ? { running: '构建中', succeeded: '完成', failed: '失败', cancelled: '已取消' } : { running: 'Building', succeeded: 'Complete', failed: 'Failed', cancelled: 'Cancelled' }
  return `${kinds[task.value.kind] ?? task.value.kind} · ${states[task.value.state]}`
})
async function act(action: () => Promise<unknown>) {
  try {
    await action()
  }
  catch (error) { console.error(zh.value ? '桌面操作失败' : 'Desktop action failed', { error }) }
}
</script>

<template>
  <footer class="editor-status-bar" :aria-label="zh ? '编辑器状态' : 'Editor status'">
    <AGUIButton variant="text" icon="i-ri-folder-open-line" @click="desktop.switcherOpen = true">
      {{ zh ? '切换项目' : 'Projects' }}
    </AGUIButton>
    <span class="status-connection" role="status">
      {{ !desktop.status.hasProject ? (zh ? '未打开项目' : 'No project') : desktop.status.connected ? (zh ? '已连接' : 'Connected') : (zh ? '连接已断开' : 'Disconnected') }}
    </span>
    <span v-if="desktop.status.hasProject" class="status-saved">{{ dirty ? (zh ? '未保存' : 'Unsaved') : (zh ? '已保存' : 'Saved') }}</span>
    <span v-if="file.openedFilePath" class="status-file" :title="file.openedFilePath">{{ file.openedFilePath }}</span>
    <span v-if="position" class="status-position">{{ zh ? `行 ${position.lineNumber}，列 ${position.column}` : `Ln ${position.lineNumber}, Col ${position.column}` }}</span>
    <AGUIButton v-if="task" variant="text" class="status-task" :class="{ 'status-task-failed': task.state === 'failed' }" :title="zh ? '任务详情与日志' : 'Task details and logs'" @click="desktop.taskDetailsOpen = true">
      {{ taskLabel }}
    </AGUIButton>
  </footer>
  <AGUIDialog v-model:open="desktop.taskDetailsOpen" :title="zh ? '任务详情与日志' : 'Task details and logs'" content-class="w-xl">
    <div v-if="task" class="desktop-task-details">
      <p role="status">
        {{ taskLabel }}
      </p>
      <p v-if="task.output">
        {{ task.output }}
      </p>
      <div class="desktop-task-actions">
        <AGUIButton v-if="task.state === 'running'" @click="act(host.cancelTask)">
          {{ zh ? '取消构建' : 'Cancel build' }}
        </AGUIButton>
        <AGUIButton v-if="task.state === 'succeeded' && !['preview', 'live'].includes(task.kind)" @click="act(host.revealOutput)">
          {{ zh ? '显示导出结果' : 'Show output' }}
        </AGUIButton>
        <AECopyErrorButton v-if="task.error" :source="`Desktop task: ${task.kind}`" :error="task.error" :logs="task.logs" :details="{ state: task.state, output: task.output }" :label="zh ? '复制信息给 AI' : 'Copy details for AI'" />
      </div>
      <p v-if="task.error" class="desktop-task-error">
        {{ task.error }}
      </p>
      <pre class="desktop-task-log">{{ task.logs }}</pre>
    </div>
  </AGUIDialog>
</template>

<style scoped>
.editor-status-bar {
  container-type: inline-size;
  display: flex;
  align-items: center;
  flex: 0 0 26px;
  min-width: 0;
  gap: 8px;
  padding: 0 8px;
  border-top: 1px solid var(--agui-c-divider);
  background: var(--agui-c-bg-panel-title);
  color: var(--agui-c-text-2);
  font-size: 12px;
  white-space: nowrap;
}
.status-file {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status-task {
  margin-left: auto;
}
.status-task-failed {
  color: var(--agui-c-danger-text);
}
.desktop-task-details {
  padding: 8px 12px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.desktop-task-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.desktop-task-error {
  color: var(--agui-c-danger-text);
}
.desktop-task-log {
  max-height: 45vh;
  overflow: auto;
  white-space: pre-wrap;
}
@container (max-width: 640px) {
  .status-file,
  .status-position {
    display: none;
  }
}
@container (max-width: 400px) {
  .status-saved {
    display: none;
  }
}
</style>
