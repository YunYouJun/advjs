<script setup lang="ts">
import type { Component } from 'vue'
import type { RegisteredView } from '../../extensions/registry'
import { editorPluginContextKey } from '@advjs/editor-sdk'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import { markRaw, onErrorCaptured, onUnmounted, provide, shallowRef } from 'vue'
import { useEditorExtensionHost } from '../../extensions/registry'
import EditorCommandBar from './EditorCommandBar.vue'

const props = defineProps<{ view: RegisteredView, visible: boolean }>()
const host = useEditorExtensionHost()
provide(editorPluginContextKey, props.view.entry.context!)
const component = shallowRef<Component>()
const error = shallowRef('')
const loading = shallowRef(false)
let generation = 0
onUnmounted(() => generation++)
onErrorCaptured((cause) => {
  error.value = cause.message
  component.value = undefined
  return false
})
async function load() {
  const current = ++generation
  error.value = ''
  loading.value = true
  try {
    const module = await props.view.load()
    if (current === generation)
      component.value = markRaw(module.default)
  }
  catch (cause) {
    if (current === generation)
      error.value = cause instanceof Error ? cause.message : String(cause)
  }
  finally {
    if (current === generation)
      loading.value = false
  }
}
void load()
</script>

<template>
  <div class="editor-view-host" :data-view="view.key">
    <EditorCommandBar :view="view.key" />
    <div v-if="error" class="editor-view-state" role="alert">
      <p>{{ host.services.locale.value === 'zh-CN' ? '面板暂时无法显示' : 'This panel could not load' }}</p>
      <p class="editor-view-error">
        {{ error }}
      </p>
      <AGUIButton @click="load">
        {{ host.services.locale.value === 'zh-CN' ? '重试' : 'Retry' }}
      </AGUIButton>
      <AGUIButton v-if="!view.entry.required" @click="host.setEnabled(view.entry.plugin.id, false)">
        {{ host.services.locale.value === 'zh-CN' ? '停用插件' : 'Disable plugin' }}
      </AGUIButton>
    </div>
    <p v-else-if="loading" class="editor-view-state" role="status">
      {{ host.services.locale.value === 'zh-CN' ? '正在加载…' : 'Loading…' }}
    </p>
    <div v-else class="editor-view-content">
      <component :is="component" :visible="visible" />
    </div>
  </div>
</template>

<style scoped>
.editor-view-host {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.editor-view-content {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.editor-view-state {
  padding: 12px;
  font-size: 13px;
}
.editor-view-error {
  color: var(--agui-c-danger-text);
  overflow-wrap: anywhere;
}
</style>
