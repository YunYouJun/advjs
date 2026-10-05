<script setup lang="ts">
import { computed } from 'vue'
import { useEditorExtensionHost } from '../../extensions/registry'
import EditorPluginRow from './EditorPluginRow.vue'

const host = useEditorExtensionHost()
const zh = computed(() => host.services.locale.value === 'zh-CN')
const active = computed(() => host.entries.filter(entry => entry.status === 'active').length)
</script>

<template>
  <section class="editor-plugin-manager" :aria-label="zh ? 'UI 插件管理' : 'UI plugin manager'">
    <header>
      <strong>{{ zh ? '编辑器插件' : 'Editor plugins' }}</strong>
      <span>{{ zh ? `已启用 ${active} / ${host.entries.length}` : `${active} / ${host.entries.length} enabled` }}</span>
    </header>
    <p class="editor-plugin-description">
      {{ zh ? '扩展面板与操作，共享编辑器的布局和外观。' : 'Extend panels and actions within the editor workspace.' }}
    </p>
    <ul>
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
header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 16px;
}
header strong {
  font-weight: 600;
}
header span,
.editor-plugin-description {
  font-size: 12px;
  color: var(--agui-c-text-2);
}
.editor-plugin-description {
  margin: 4px 0 8px;
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
</style>
