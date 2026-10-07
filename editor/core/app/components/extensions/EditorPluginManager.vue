<script setup lang="ts">
import { computed } from 'vue'
import { useEditorExtensionHost } from '../../extensions/registry'
import EditorCommandBar from './EditorCommandBar.vue'
import EditorPluginRow from './EditorPluginRow.vue'

const host = useEditorExtensionHost()
const nativeMenu = import.meta.client && window.advDesktop?.nativeMenu === true
const zh = computed(() => host.services.locale.value === 'zh-CN')
const active = computed(() => host.entries.filter(entry => entry.status === 'active').length)
</script>

<template>
  <section class="editor-plugin-manager" :aria-label="zh ? 'UI 插件管理' : 'UI plugin manager'">
    <div class="editor-plugin-summary">
      <header class="editor-plugin-header">
        <strong class="editor-plugin-title">{{ zh ? '编辑器插件' : 'Editor plugins' }}</strong>
        <span class="editor-plugin-count">{{ zh ? `已启用 ${active} / ${host.entries.length}` : `${active} / ${host.entries.length} enabled` }}</span>
      </header>
      <p class="editor-plugin-description">
        {{ zh ? '启用或停用插件，使用插件提供的面板和命令。' : 'Enable or disable plugins and use their panels and commands.' }}
      </p>
      <EditorCommandBar v-if="nativeMenu" toolbar />
    </div>
    <ul class="editor-plugin-list">
      <EditorPluginRow v-for="entry in host.entries" :key="entry.plugin.id" :entry="entry" />
    </ul>
  </section>
</template>

<style scoped>
.editor-plugin-manager {
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
}
.editor-plugin-summary {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
}
.editor-plugin-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 16px;
}
.editor-plugin-title {
  font-weight: 600;
}
.editor-plugin-count,
.editor-plugin-description {
  font-size: 12px;
  color: var(--agui-c-text-2);
}
.editor-plugin-description {
  margin: 0;
}
.editor-plugin-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
