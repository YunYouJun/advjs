<script setup lang="ts">
import type { FlowNodeKind } from '@advjs/core'
import { createFlowNode, FLOW_NODE_KINDS, flowDocumentsFromFiles } from '@advjs/core'
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'
import AGUIDialog from '@advjs/gui/components/dialog/AGUIDialog.vue'
import AGUIInput from '@advjs/gui/components/input/AGUIInput.vue'
import AGUISelect from '@advjs/gui/components/select/AGUISelect.vue'
import { computed, ref } from 'vue'
import { useNativeFlowAuthoring } from '../../../composables/useNativeFlowAuthoring'
import { useProjectSourceNavigation } from '../../../composables/useProjectSourceNavigation'
import { useProjectStore } from '../../../stores/useProjectStore'
import NativeFlowCanvas from './NativeFlowCanvas.vue'
import NativeFlowInspector from './NativeFlowInspector.vue'
import './styles'

defineProps<{ visible?: boolean }>()
const project = useProjectStore()
const state = useNativeFlowAuthoring()
const navigation = useProjectSourceNavigation()
const kind = ref<FlowNodeKind>('narration')
const newChapter = ref(false)
const chapterId = ref('')
const chapterTitle = ref('新章节')
const labels = ['入口', '对白', '旁白', '条件选项', '背景', '角色演出', '音频', '结束']
const otherChapters = computed(() => {
  try {
    return flowDocumentsFromFiles(project.project?.files ?? {}).filter(document => document.id !== state.document.value?.id)
  }
  catch { return [] }
})
async function createChapter() {
  await state.createChapter(chapterId.value, chapterTitle.value)
  if (!state.error.value)
    newChapter.value = false
}
</script>

<template>
  <section class="native-flow-editor" aria-label="原生 JSON Flow 编辑器" data-testid="native-flow-editor">
    <div class="native-toolbar">
      <AGUISelect v-if="state.chapterPaths.value.length" :disabled="state.saving.value" label="JSON 章节" :model-value="state.path.value" :options="state.chapterPaths.value.map(path => ({ value: path, label: path.split('/').at(-1) }))" @update:model-value="state.open(String($event))" />
      <AGUIButton :disabled="!state.writable.value || state.saving.value || state.loading.value" @click="newChapter = !newChapter">
        新建章节
      </AGUIButton>
      <AGUISelect v-model="kind" label="添加节点类型" :options="FLOW_NODE_KINDS.map((value, index) => ({ value, label: labels[index] }))" />
      <AGUIButton :disabled="!state.document.value || !state.writable.value || state.saving.value || state.loading.value" data-testid="native-node-add" @click="state.edit({ type: 'add-node', node: createFlowNode(kind) })">
        添加节点
      </AGUIButton>
      <AGUIButton :disabled="!state.current.value?.history.past.length || state.saving.value || state.loading.value" data-testid="native-flow-undo" @click="state.history('undo')">
        撤销
      </AGUIButton>
      <AGUIButton :disabled="!state.current.value?.history.future.length || state.saving.value || state.loading.value" data-testid="native-flow-redo" @click="state.history('redo')">
        重做
      </AGUIButton>
      <AGUIButton :disabled="!state.path.value || state.saving.value || state.loading.value" @click="state.requestReload">
        {{ state.current.value?.snapshot.content === null ? '放弃新章节' : '载入项目版本' }}
      </AGUIButton>
      <AGUIButton :disabled="!state.path.value || state.dirty.value || navigation.busy.value" @click="navigation.navigate({ path: state.path.value, line: 1, column: 1 })">
        打开 JSON 源码
      </AGUIButton>
      <AGUIButton theme="primary" :disabled="!state.canSave.value" :loading="state.saving.value" data-testid="native-flow-save" @click="state.save">
        保存 JSON
      </AGUIButton>
      <span>{{ state.dirty.value ? '草稿未保存' : '已保存' }}</span>
    </div>
    <AGUIDialog :open="Boolean(state.pendingReload.value)" title="放弃未保存的 Flow 草稿？" :description="state.current.value?.snapshot.content === null ? '放弃将移除尚未保存的新章节及其撤销历史。取消可继续编辑；项目文件不会被修改。' : '载入项目版本会替换当前章节的未保存修改和撤销历史。取消可继续编辑；项目文件不会被修改。'" content-class="w-md" @update:open="!$event && state.cancelReload()">
      <div class="native-reload-actions">
        <AGUIButton @click="state.cancelReload">
          取消
        </AGUIButton>
        <AGUIButton @click="state.confirmReload">
          {{ state.current.value?.snapshot.content === null ? '放弃新章节' : '放弃草稿并载入' }}
        </AGUIButton>
      </div>
    </AGUIDialog>
    <div v-if="newChapter" class="native-create">
      <AGUIInput v-model="chapterId" aria-label="新章节 ID" placeholder="chapter-id" />
      <AGUIInput v-model="chapterTitle" aria-label="新章节标题" placeholder="标题" />
      <AGUIButton :disabled="state.saving.value || state.loading.value" @click="createChapter">
        创建章节草稿
      </AGUIButton>
    </div>
    <p v-if="state.error.value || navigation.error.value" class="native-flow-error" role="alert">
      {{ state.error.value || navigation.error.value }}
    </p>
    <p v-if="state.conflict.value" class="native-flow-error" role="status">
      项目源文件已经改变。草稿仍在；请比较源文件或载入项目版本后重新编辑。
    </p>
    <p v-if="state.status.value" class="native-flow-status" role="status">
      {{ state.status.value }}
    </p>
    <div v-if="state.document.value" class="native-chapter">
      <AGUIInput :disabled="state.saving.value || state.loading.value" aria-label="章节标题" :model-value="state.document.value.title" @update:model-value="state.edit({ type: 'set-title', title: $event })" />
      <AGUISelect label="选中节点" :model-value="state.selectedNodeId.value" :options="state.document.value.nodes.map((node, index) => ({ value: node.id, label: `${index + 1} · ${node.type ?? 'dialogues'} · ${node.id}` }))" @update:model-value="state.selectedNodeId.value = String($event)" />
      <span>{{ state.document.value.nodes.length }} 节点 · {{ state.path.value }}</span>
    </div>
    <div v-if="state.document.value" class="native-content">
      <NativeFlowCanvas :visible="visible" :document="state.document.value" :selected-node-id="state.selectedNodeId.value" :disabled="!state.writable.value || state.saving.value || state.loading.value" @edit="state.edit" @select="state.selectedNodeId.value = $event" />
      <NativeFlowInspector v-if="state.selectedNode.value" :document="state.document.value" :node="state.selectedNode.value" :catalog="project.project?.compilation.project.assets" :other-chapters="otherChapters" :disabled="!state.writable.value || state.saving.value || state.loading.value" @edit="state.edit" />
    </div>
    <p v-else class="native-flow-status">
      {{ state.loading.value ? '正在载入 JSON 章节…' : '新建或打开原生 .chapter.json 章节。内联章节需先保存为明确的 JSON 文件。' }}
    </p>
    <details class="native-diagnostics" :open="state.diagnostics.value.some(issue => issue.severity === 'error')">
      <summary>编译诊断 {{ state.diagnostics.value.length }}</summary><p v-for="(issue, index) in state.diagnostics.value" :key="index" :class="{ 'native-flow-error': issue.severity === 'error' }">
        {{ issue.code }} · {{ issue.message }}
      </p>
    </details>
  </section>
</template>

<style scoped>
.native-flow-editor {
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  container-type: inline-size;
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-soft);
  font-size: 12px;
  overflow: hidden;
}
.native-reload-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 12px;
}
.native-toolbar,
.native-create,
.native-chapter {
  padding: 4px 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--agui-c-divider);
  min-width: 0;
}
.native-toolbar :deep(.agui-select-trigger) {
  max-width: 200px;
}
.native-chapter :deep(input) {
  max-width: 200px;
}
.native-chapter span {
  color: var(--agui-c-text-2);
  overflow-wrap: anywhere;
}
.native-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  flex: 1;
  min-height: 0;
}
.native-content > :last-child {
  border-left: 1px solid var(--agui-c-divider);
}
.native-flow-error,
.native-flow-status {
  margin: 0;
  padding: 6px 8px;
  overflow-wrap: anywhere;
}
.native-flow-error {
  color: var(--agui-c-danger-text);
}
.native-flow-status {
  color: var(--agui-c-text-2);
}
.native-diagnostics {
  border-top: 1px solid var(--agui-c-divider);
  padding: 4px 8px;
  max-height: 140px;
  overflow: auto;
}
.native-diagnostics p {
  margin: 4px 0;
  overflow-wrap: anywhere;
}
@container (max-width: 650px) {
  .native-content {
    display: flex;
    flex-direction: column;
    overflow: auto;
  }
  .native-content > :first-child {
    height: 300px;
    flex: none;
  }
  .native-content > :last-child {
    height: auto;
    overflow: visible;
    border-left: 0;
    border-top: 1px solid var(--agui-c-divider);
  }
  .native-chapter :deep(.agui-select-trigger) {
    max-width: 280px;
  }
  .native-create :deep(input) {
    width: 100%;
  }
}
</style>
