<script setup lang="ts">
import { useDesktopStore } from '../../stores/useDesktopStore'

const desktop = useDesktopStore()
const console = useConsoleStore()
const { locale } = useI18n()
const zh = computed(() => locale.value === 'zh-CN')
const busy = shallowRef(false)
const host = window.advDesktop!
watch(() => desktop.switcherOpen, (open) => {
  if (open)
    void desktop.refreshProjects()
})
async function act(action: () => Promise<unknown>) {
  busy.value = true
  try {
    if (await action())
      desktop.switcherOpen = false
    await desktop.refreshProjects()
  }
  catch (error) { console.error(zh.value ? '无法切换项目' : 'Could not switch project', { error }) }
  finally { busy.value = false }
}
</script>

<template>
  <AGUIDialog v-model:open="desktop.switcherOpen" :title="zh ? '切换项目' : 'Switch project'" content-class="w-xl">
    <div class="project-switcher">
      <div class="switcher-actions">
        <AGUIButton :disabled="busy" icon="i-ri-folder-open-line" @click="act(() => host.openProject())">
          {{ zh ? '打开项目…' : 'Open project…' }}
        </AGUIButton>
        <AGUIButton :disabled="busy" @click="act(() => host.openProject('current'))">
          {{ zh ? '在当前窗口打开…' : 'Open in current window…' }}
        </AGUIButton>
        <AGUIButton :disabled="busy" @click="act(host.newWindow)">
          {{ zh ? '新建窗口' : 'New window' }}
        </AGUIButton>
      </div>
      <section :aria-label="zh ? '已打开' : 'Opened'">
        <h3>{{ zh ? '已打开' : 'Opened' }}</h3>
        <p v-if="!desktop.projects.opened.length">
          {{ zh ? '暂无已打开的项目' : 'No open projects' }}
        </p>
        <div v-for="project in desktop.projects.opened" :key="project.id" class="switcher-row">
          <AGUIButton variant="text" class="switcher-project" :disabled="busy" :title="project.path" @click="act(() => host.focusProject(project.id))">
            <span>{{ project.name }}{{ project.current ? (zh ? '（当前窗口）' : ' (current)') : '' }}</span>
            <small>{{ project.path }}</small>
          </AGUIButton>
        </div>
      </section>
      <section :aria-label="zh ? '最近使用' : 'Recent'">
        <h3>{{ zh ? '最近使用' : 'Recent' }}</h3>
        <p v-if="!desktop.projects.recent.length">
          {{ zh ? '暂无最近项目' : 'No recent projects' }}
        </p>
        <div v-for="project in desktop.projects.recent" :key="project.id" class="switcher-row">
          <AGUIButton variant="text" class="switcher-project" :disabled="busy" :title="project.path" @click="act(() => host.openRecent(project.id))">
            <span>{{ project.name }}</span><small>{{ project.path }}</small>
          </AGUIButton>
          <AGUIIconButton icon="i-ri-login-box-line" :disabled="busy" :title="zh ? `在当前窗口打开 ${project.name}` : `Open ${project.name} in current window`" @click="act(() => host.openRecent(project.id, 'current'))" />
        </div>
      </section>
    </div>
  </AGUIDialog>
</template>

<style scoped>
.project-switcher {
  padding: 8px 12px 12px;
  font-size: 12px;
}
.switcher-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
h3 {
  margin: 16px 0 4px;
  padding-bottom: 4px;
  font-size: 12px;
  border-bottom: 1px solid var(--agui-c-divider);
}
p,
small {
  color: var(--agui-c-text-2);
}
.switcher-row {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 4px;
}
.switcher-project {
  flex: 1;
  height: auto;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  padding: 6px 4px;
}
.switcher-project span,
.switcher-project small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
