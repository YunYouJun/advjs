<script setup lang="ts">
import type { DesktopTask } from '~/types/desktop'

const project = useProjectStore()
const task = ref<DesktopTask>()
const error = ref('')
const host = window.advDesktop!
const recent = ref<{ id: string, name: string }[]>([])
let timer: ReturnType<typeof setInterval> | undefined
async function act(action: () => Promise<unknown>) {
  error.value = ''
  try {
    await action()
    task.value = await host.taskStatus()
  }
  catch (failure) {
    error.value = String(failure)
  }
}
onMounted(async () => {
  recent.value = await host.recentProjects()
  timer = setInterval(() => {
    if (task.value?.state === 'running')
      void host.taskStatus().then(value => task.value = value)
  }, 400)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="desktop-toolbar ae-resource-panel" aria-label="桌面项目">
    <div class="desktop-actions">
      <AGUIButton @click="act(host.openProject)">
        打开项目
      </AGUIButton>
      <select aria-label="最近项目" class="agui-input" @change="act(() => host.openRecent(($event.target as HTMLSelectElement).value))">
        <option value="">
          最近项目
        </option><option v-for="item in recent" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </select>
      <AGUIButton @click="act(host.reconnect)">
        重新连接项目
      </AGUIButton>
      <span class="ae-resource-name">{{ project.rootDir?.name ?? '未打开项目' }}</span>
      <AGUIButton :disabled="!project.workspace || task?.state === 'running'" @click="act(host.preview)">
        游戏预览
      </AGUIButton>
      <AGUIButton @click="act(host.stopPreview)">
        停止预览
      </AGUIButton>
      <AGUIButton :disabled="!project.workspace || task?.state === 'running'" @click="act(() => host.exportGame('directory'))">
        导出 Web 目录
      </AGUIButton>
      <AGUIButton :disabled="!project.workspace || task?.state === 'running'" @click="act(() => host.exportGame('zip'))">
        导出 ZIP
      </AGUIButton>
    </div>
    <details v-if="task" :open="task.state === 'failed'" class="px-2">
      <summary role="status">
        {{ task.kind }} · {{ task.state }} <span v-if="task.output">{{ task.output }}</span>
      </summary>
      <AGUIButton v-if="task.state === 'running'" @click="act(host.cancelTask)">
        取消构建
      </AGUIButton>
      <AGUIButton v-if="task.state === 'succeeded' && task.kind !== 'preview'" @click="act(host.revealOutput)">
        在 Finder 中显示
      </AGUIButton>
      <p v-if="task.error" class="ae-resource-error">
        {{ task.error }}
      </p><pre class="desktop-log">{{ task.logs }}</pre>
    </details>
    <p v-if="error" class="ae-resource-error px-2" role="alert">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.desktop-toolbar {
  border-bottom: 1px solid var(--agui-c-divider);
}
.desktop-actions {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px;
  flex-wrap: wrap;
}
.desktop-actions > select {
  flex: 0 1 180px;
  width: 180px;
  max-width: 100%;
}
.desktop-log {
  max-height: 160px;
  overflow: auto;
  font-size: 11px;
  white-space: pre-wrap;
}
</style>
