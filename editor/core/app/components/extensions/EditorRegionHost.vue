<script setup lang="ts">
import type { EditorRegion } from '@advjs/editor-sdk'
import { editorText } from '@advjs/editor-sdk'
import AGUIPanel from '@advjs/gui/components/AGUIPanel.vue'
import AGUITabPanel from '@advjs/gui/components/tabs/AGUITabPanel.vue'
import AGUITabs from '@advjs/gui/components/tabs/AGUITabs.vue'
import { computed, nextTick, shallowRef, watch } from 'vue'
import { editorIcon } from '../../extensions/icons'
import { useEditorLayoutState } from '../../extensions/layout-state'
import { useEditorExtensionHost } from '../../extensions/registry'
import EditorViewHost from './EditorViewHost.vue'

const props = defineProps<{ region: EditorRegion }>()
const host = useEditorExtensionHost()
const layout = useEditorLayoutState()
const root = shallowRef<HTMLElement>()
const visited = shallowRef(new Set<string>())
const views = computed(() => host.views.value.filter(view => view.region === props.region))
const selected = computed({
  get: () => layout.resolve(props.region, views.value),
  set: (id: string) => layout.select(props.region, id),
})
const tabs = computed(() => views.value.map(view => ({ key: view.key, title: editorText(view.title, host.services.locale.value, view.id), icon: editorIcon(view.icon) })))
watch(selected, async (id, previous) => {
  visited.value = new Set([...visited.value, id])
  const focusInside = root.value?.contains(document.activeElement)
  if (previous && focusInside && !views.value.some(view => view.key === previous)) {
    await nextTick()
    root.value?.querySelector<HTMLElement>('[role="tab"][data-state="active"]')?.focus()
  }
}, { immediate: true })
watch(views, (available) => {
  visited.value = new Set([...visited.value].filter(id => available.some(view => view.key === id)))
})
</script>

<template>
  <div ref="root" class="editor-region" :data-editor-region="region">
    <AGUIPanel class="editor-region-panel">
      <AGUITabs v-if="tabs.length" v-model="selected" :list="tabs" :label="region">
        <template #actions>
          <slot name="actions" />
        </template>
        <AGUITabPanel
          v-for="view in views" v-show="selected === view.key"
          :key="`${view.key}:${view.entry.generation}`"
          :value="view.key" :force-mount="view.retention === 'keep-alive'"
        >
          <EditorViewHost
            v-if="selected === view.key || (view.retention === 'keep-alive' && visited.has(view.key))"
            :view="view" :visible="selected === view.key"
          />
        </AGUITabPanel>
      </AGUITabs>
      <p v-else class="editor-region-empty">
        {{ host.services.locale.value === 'zh-CN' ? '此区域暂无可用面板' : 'No panels available' }}
      </p>
    </AGUIPanel>
  </div>
</template>

<style scoped>
.editor-region,
.editor-region-panel {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
.editor-region {
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
}
.editor-region-empty {
  padding: 12px;
  font-size: 12px;
}
</style>
