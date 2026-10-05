<script setup lang="ts">
import { editorText } from '@advjs/editor-sdk'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIDropdownMenu from '@advjs/gui/components/dropdown-menu/AGUIDropdownMenu.vue'
import { computed } from 'vue'
import { editorIcon } from '../../extensions/icons'
import { useEditorExtensionHost } from '../../extensions/registry'

const props = defineProps<{ view?: string, toolbar?: boolean }>()
const host = useEditorExtensionHost()
const locale = host.services.locale
const actions = computed(() => host.entries.flatMap(entry => entry.status === 'active'
  ? (entry.plugin.actions ?? []).filter(action => props.toolbar
      ? action.location === 'editor.toolbar'
      : typeof action.location === 'object' && `${entry.plugin.id}/${action.location.view}` === props.view).map(action => ({ ...action, key: `${entry.plugin.id}/${action.command}`, command: entry.plugin.commands!.find(command => command.id === action.command)! }))
  : []))
const errors = computed(() => actions.value.map(action => host.commands[action.key]?.error).filter(Boolean))
const menu = computed(() => ({
  type: 'dropdown' as const,
  name: locale.value === 'zh-CN' ? '扩展操作' : 'Extension actions',
  title: locale.value === 'zh-CN' ? '扩展操作' : 'Extension actions',
  icon: 'i-ri-puzzle-line',
  children: actions.value.map(action => ({
    type: 'item' as const,
    label: editorText(action.command.title, locale.value, action.command.id),
    icon: editorIcon(action.icon),
    disabled: !host.canExecute(action.key),
    onClick: () => { void host.execute(action.key) },
  })),
}))
</script>

<template>
  <div v-if="actions.length" class="editor-command-bar" :class="{ 'editor-command-bar-inline': toolbar }">
    <AGUIDropdownMenu v-if="toolbar" :data="menu" />
    <div v-else class="editor-command-actions" role="group" :aria-label="locale === 'zh-CN' ? '面板操作' : 'Panel actions'">
      <AGUIButton
        v-for="action in actions" :key="action.key"
        :icon="editorIcon(action.icon)"
        :disabled="!host.canExecute(action.key)"
        :loading="host.commands[action.key]?.busy"
        @click="host.execute(action.key)"
      >
        {{ editorText(action.command.title, locale, action.command.id) }}
      </AGUIButton>
    </div>
    <p v-for="error in errors" :key="error" role="alert" class="editor-extension-error" :title="error">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
.editor-command-bar {
  padding: 4px 8px;
  border-bottom: 1px solid var(--agui-c-divider);
}
.editor-command-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.editor-command-bar-inline {
  display: flex;
  align-items: center;
  padding: 0;
  border: 0;
  min-width: 0;
}
.editor-command-bar-inline .editor-extension-error {
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.editor-extension-error {
  margin: 4px 0;
  color: var(--agui-c-danger-text);
  overflow-wrap: anywhere;
  font-size: 12px;
}
</style>
