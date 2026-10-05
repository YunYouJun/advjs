<script setup lang="ts">
import type { PluginEntry } from '../../extensions/registry'
import { editorText } from '@advjs/editor-sdk'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { computed } from 'vue'
import { useEditorLayoutState } from '../../extensions/layout-state'
import { useEditorExtensionHost } from '../../extensions/registry'

const props = defineProps<{ entry: PluginEntry }>()
const host = useEditorExtensionHost()
const layout = useEditorLayoutState()
const locale = host.services.locale
const zh = computed(() => locale.value === 'zh-CN')
const status = computed(() => ({ active: zh.value ? '已启用' : 'Enabled', disabled: zh.value ? '已停用' : 'Disabled', activating: zh.value ? '正在启用' : 'Enabling', error: zh.value ? '启动失败' : 'Failed' })[props.entry.status])
const canDisable = computed(() => props.entry.status === 'active' || props.entry.status === 'activating')
const toggleLabel = computed(() => props.entry.status === 'activating'
  ? (zh.value ? '取消启用' : 'Cancel activation')
  : canDisable.value ? (zh.value ? '停用' : 'Disable') : (zh.value ? '启用' : 'Enable'))
function open() {
  const view = props.entry.plugin.views?.[0]
  if (view)
    layout.select(view.region, `${props.entry.plugin.id}/${view.id}`)
}
</script>

<template>
  <li class="editor-plugin-row" :data-plugin="entry.plugin.id">
    <div class="editor-plugin-info">
      <div class="editor-plugin-heading">
        <strong>{{ editorText(entry.plugin.title, locale, entry.plugin.id) }}</strong>
        <span>v{{ entry.plugin.version }}</span>
        <span>{{ entry.required ? (zh ? '核心' : 'Core') : entry.source === 'builtin' ? (zh ? '内置扩展' : 'Built-in') : (zh ? '随附插件' : 'Bundled') }}</span>
      </div>
      <p>{{ editorText(entry.plugin.description, locale, entry.plugin.id) }}</p>
      <p v-if="entry.error" class="editor-plugin-error" role="alert">
        {{ entry.error }}
      </p>
    </div>
    <div class="editor-plugin-controls">
      <span role="status">{{ status }}</span>
      <AGUIButton v-if="entry.status === 'active' && !entry.required && entry.plugin.views?.length" @click="open">
        {{ zh ? '打开面板' : 'Open panel' }}
      </AGUIButton>
      <AGUIButton
        :disabled="entry.required"
        :aria-label="`${entry.required ? (zh ? '必需' : 'Required') : toggleLabel} ${editorText(entry.plugin.title, locale, entry.plugin.id)}`"
        @click="host.setEnabled(entry.plugin.id, !canDisable)"
      >
        {{ entry.required ? (zh ? '必需' : 'Required') : toggleLabel }}
      </AGUIButton>
    </div>
  </li>
</template>

<style scoped>
.editor-plugin-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 8px 0;
  border-top: 1px solid var(--agui-c-divider);
}
.editor-plugin-info {
  flex: 1 1 220px;
  min-width: 0;
}
.editor-plugin-heading,
.editor-plugin-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}
.editor-plugin-heading strong {
  font-weight: 600;
}
.editor-plugin-heading span,
p,
.editor-plugin-controls > span {
  font-size: 12px;
  color: var(--agui-c-text-2);
}
p {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
}
.editor-plugin-error {
  color: var(--agui-c-danger-text);
}
</style>
