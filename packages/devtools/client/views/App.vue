<script setup lang="ts">
import AGUIButton from '@advjs/gui/client/components/button/AGUIButton.vue'
import AGUIIconButton from '@advjs/gui/client/components/button/AGUIIconButton.vue'
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useDevTools } from '../composables/useDevTools'
import { useDevToolsWindow } from '../composables/useDevToolsWindow'
import { jsonHighlightKey } from '../composables/useJsonHighlight'
import DiagnosticsView from './DiagnosticsView.vue'
import ResourcesView from './ResourcesView.vue'
import RuntimeView from './RuntimeView.vue'

const { report, error, connected, connect, highlightJson } = useDevTools()
provide(jsonHighlightKey, { ready: connected, highlight: highlightJson })
const params = new URLSearchParams(location.search)
const tabs = [{ id: 'runtime', label: '运行时' }, { id: 'resources', label: '资源' }, { id: 'diagnostics', label: '诊断' }]
const selected = ref(params.get('session') ?? '')
const tab = ref(tabs.find(item => item.id === params.get('view'))?.id ?? 'runtime')
watch(() => report.value?.sessions, (sessions) => {
  if (!sessions?.some(item => item.id === selected.value))
    selected.value = sessions?.[0]?.id ?? ''
})
const session = computed(() => report.value?.sessions.find(item => item.id === selected.value) ?? report.value?.sessions[0])
const dark = ref(params.get('theme') === 'dark' || (params.get('theme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches))
const { independent, blocked, windowUrl, openWindow } = useDevToolsWindow(selected, tab, dark)
function exportReport() {
  if (!report.value || !session.value)
    return
  const url = URL.createObjectURL(new Blob([JSON.stringify({
    schemaVersion: 1,
    project: report.value.project,
    session: session.value,
  }, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'advjs-devtools-report.json'
  anchor.click()
  URL.revokeObjectURL(url)
}
function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.classList.toggle('dark', dark.value)
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && window.parent !== window)
    window.parent.postMessage('advjs-devtools:close', location.origin)
}
onMounted(() => {
  document.documentElement.classList.toggle('dark', dark.value)
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <main class="devtools">
    <header class="toolbar">
      <strong>ADV.JS</strong>
      <span class="connection">{{ connected ? '已连接' : error ? '已断开' : '连接中' }}</span>
      <select v-if="report?.sessions.length" v-model="selected" aria-label="游戏会话">
        <option v-for="item in report.sessions" :key="item.id" :value="item.id">
          {{ item.snapshot.title }} · {{ item.id }}
        </option>
      </select>
      <AGUIButton class="report-export" :disabled="!session" @click="exportReport">
        导出
      </AGUIButton>
      <AGUIButton @click="toggleTheme">
        {{ dark ? '浅色' : '深色' }}
      </AGUIButton>
      <AGUIIconButton v-if="!independent" title="在独立窗口打开" @click="openWindow">
        <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M26 28H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10v2H6v20h20V16h2v10a2 2 0 0 1-2 2Z" />
          <path d="M20 2v2h6.59L14 16.59 15.41 18 28 5.41V12h2V2H20Z" />
        </svg>
      </AGUIIconButton>
    </header>
    <div v-if="error" class="connection-error" role="alert">
      <span>连接失败：{{ error }}</span>
      <AGUIButton @click="connect">
        重新连接
      </AGUIButton>
    </div>
    <div v-if="blocked" class="connection-error" role="alert">
      <span>浏览器阻止了弹出窗口。</span>
      <a :href="windowUrl" target="_blank" rel="noopener">在新标签页打开</a>
    </div>
    <nav class="tabs" aria-label="调试视图">
      <button v-for="item in tabs" :key="item.id" type="button" :aria-current="tab === item.id ? 'page' : undefined" @click="tab = item.id">
        {{ item.label }}
      </button>
    </nav>
    <div v-if="!session" class="empty">
      <strong>等待游戏运行时</strong>
      <p>打开游戏页面即可查看状态、剧情追踪和编译诊断。</p>
      <code v-if="report">{{ report.project.root }}</code>
    </div>
    <div v-else class="content">
      <RuntimeView v-if="tab === 'runtime'" :snapshot="session.snapshot" />
      <ResourcesView v-else-if="tab === 'resources'" :resources="session.snapshot.resources" />
      <DiagnosticsView v-else :diagnostics="session.snapshot.diagnostics" :runtime-error="session.snapshot.state.error" />
    </div>
  </main>
</template>
