<script setup lang="ts">
import type { AdvProjectDiagnostic } from '@advjs/types'
import type { ProjectFlowSource } from '../../../utils/project-flow'
import type { ProjectFlowViewEdge, ProjectFlowViewNode, ProjectFlowViewSelection } from '../../../utils/project-flow-view'
import { Toast } from '@advjs/gui'
import AGUIIconButton from '@advjs/gui/components/button/AGUIIconButton.vue'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { getRectOfNodes, getTransformForBounds, Position, useNodesInitialized, useVueFlow, VueFlow } from '@vue-flow/core'
import { MiniMap } from '@vue-flow/minimap'
import { computed, nextTick, onBeforeUnmount, shallowRef, useId, watch } from 'vue'
import { useProjectSourceNavigation } from '../../../composables/useProjectSourceNavigation'
import ProjectFlowDiagnostics from './ProjectFlowDiagnostics.vue'
import ProjectFlowNode from './ProjectFlowNode.vue'
import ProjectFlowRoutes from './ProjectFlowRoutes.vue'
import ProjectFlowToolbar from './ProjectFlowToolbar.vue'

import './styles'

const props = withDefaults(defineProps<{ visible?: boolean }>(), { visible: true })
const flowStore = useFlowStore()
const project = useProjectStore()
const navigation = useProjectSourceNavigation()
const { locale } = useEditorLocale()
const zh = computed(() => locale.value === 'zh-CN')
const refreshError = shallowRef('')
const selectedRoutes = shallowRef<ProjectFlowViewEdge>()
// The view owns the renderer's effect scope; the Pinia store only owns graph data.
const flow = useVueFlow(useId())
const nodesInitialized = useNodesInitialized()
function graphMinZoom(width: number, height: number, bounds = getRectOfNodes(flow.getNodes.value)) {
  if (!width || !height || !bounds.width || !bounds.height)
    return 0.2
  // Large stories still need a complete overview before zooming into a chapter.
  return Math.min(0.2, width / (bounds.width * 1.25), height / (bounds.height * 1.25))
}
const controlClearance = 40
const minZoom = computed(() => graphMinZoom(flow.dimensions.value.width, Math.max(0, flow.dimensions.value.height - controlClearance)))
let generation = 0
let fitPending: { direction: 'LR' | 'TB', force: boolean } | undefined
let restoringViewport = true
let renderedKey = ''
// Ignore the old renderer's events while a different projection is mounting.
watch(() => ({ ...flow.viewport.value }), (viewport) => {
  if (!restoringViewport)
    flowStore.setViewport(viewport, renderedKey)
}, { flush: 'post' })
watch(() => props.visible, () => {
  generation++
  restoringViewport = true
  fitPending = undefined
  if (props.visible)
    void synchronizeView()
}, { flush: 'sync' })
watch(() => [project.workspace, project.project] as const, ([workspace, model]) => {
  refreshError.value = ''
  void flowStore.loadProject(model, workspace)
}, { immediate: true, flush: 'sync' })
watch(() => flowStore.revision, () => {
  selectedRoutes.value = undefined
  void synchronizeView()
}, { flush: 'sync' })
onBeforeUnmount(() => {
  generation++
  fitPending = undefined
})

async function synchronizeView() {
  const current = ++generation
  restoringViewport = true
  fitPending = undefined
  if (!props.visible || !flowStore.visibleNodes.length)
    return
  await nextTick()
  if (!props.visible || current !== generation)
    return
  if (flowStore.requiresFit) {
    void fitAfterLayout()
    return
  }
  const key = flowStore.currentView?.key ?? ''
  await flow.setViewport({ ...flowStore.viewport })
  if (props.visible && current === generation) {
    renderedKey = key
    restoringViewport = false
  }
}

async function fitAfterLayout(direction: 'LR' | 'TB' = flowStore.direction, force = false) {
  if (!props.visible || !flowStore.visibleNodes.length)
    return
  const current = ++generation
  const key = flowStore.currentView?.key ?? ''
  restoringViewport = true
  fitPending = { direction, force }
  await nextTick()
  if (props.visible && current === generation && nodesInitialized.value && flowStore.visibleNodes.length) {
    fitPending = undefined
    flowStore.layoutGraph(direction, flow.findNode, force)
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    if (!props.visible || current !== generation)
      return
    const fitted = await fitVisibleNodes()
    if (!props.visible || current !== generation)
      return
    renderedKey = key
    if (fitted)
      flowStore.didFit()
    restoringViewport = false
  }
}
flow.onNodesInitialized(() => {
  if (fitPending)
    void fitAfterLayout(fitPending.direction, fitPending.force)
})

function layoutGraph(direction: 'LR' | 'TB' = flowStore.direction, force = false) {
  void fitAfterLayout(direction, force)
}

async function fitVisibleNodes() {
  const canvas = flow.viewportRef.value
  if (!props.visible || !flowStore.visibleNodes.length || !canvas?.offsetWidth || !canvas.offsetHeight)
    return false
  const nodes = flow.getNodes.value.filter(node => !node.hidden && node.dimensions.width && node.dimensions.height)
  if (!nodes.length)
    return false
  const bounds = getRectOfNodes(nodes)
  // ResizeObserver can report the previous panel size during the layout frame.
  // Fit to the current canvas without changing the renderer's dimensions.
  const width = canvas.offsetWidth
  // Leave the bottom control strip clear, including in a 320px chapter view.
  const height = Math.max(1, canvas.offsetHeight - controlClearance)
  const key = flowStore.currentView?.key
  await flow.setViewport(getTransformForBounds(bounds, width, height, graphMinZoom(width, height, bounds), 1.25, 0.1))
  flowStore.setViewport(flow.viewport.value, key)
  return true
}

async function fitResizedCanvas() {
  const current = generation
  await nextTick()
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  if (!restoringViewport && current === generation)
    await fitVisibleNodes()
}

function navigateTo(selection: ProjectFlowViewSelection) {
  flowStore.navigateTo(selection)
}
function showDetails(chapterId?: string) {
  chapterId ? flowStore.showDetails(chapterId) : flowStore.showAll()
}
function inspectEdge({ edge }: { edge: { data?: ProjectFlowViewEdge } }) {
  selectedRoutes.value = edge.data
}
function inspectNode(node: ProjectFlowViewNode) {
  const related = flowStore.currentView?.edges.filter(edge => edge.source === node.id || edge.target === node.id) ?? []
  const first = related[0]
  if (!first)
    return
  const routes = [...new Map(related.flatMap(edge => edge.routes).map(route => [route.edge.id, route])).values()]
  selectedRoutes.value = { ...first, id: `routes:${node.id}`, routes }
}

async function refreshData() {
  refreshError.value = ''
  try {
    await project.refreshProject()
  }
  catch (cause) { refreshError.value = cause instanceof Error ? cause.message : String(cause) }
}

async function openSource(source?: ProjectFlowSource) {
  if (source && !flowStore.loading) {
    const opened = await navigation.navigate(source)
    if (!opened && navigation.error.value) {
      Toast({ title: zh.value ? '无法定位源码' : 'Could not open source', description: navigation.error.value, type: 'error' })
    }
  }
}
function openDiagnostic(item: AdvProjectDiagnostic) {
  if (item.path)
    void openSource({ path: item.path, line: item.line ?? 1, column: item.column ?? 1 })
}

const sourcePosition = computed(() => flowStore.direction === 'LR' ? Position.Right : Position.Bottom)
const targetPosition = computed(() => flowStore.direction === 'LR' ? Position.Left : Position.Top)
const busy = computed(() => navigation.busy.value || flowStore.loading)
const displayEdges = computed(() => flowStore.visibleEdges.map((edge) => {
  const data = edge.data as ProjectFlowViewEdge | undefined
  if (zh.value || !data || data.routes.length <= 1)
    return edge
  return { ...edge, label: data.summary ? `Summary of ${data.routes.length} transitions` : `${data.routes.length} transitions` }
}))
</script>

<template>
  <section class="advjs-flow-editor" :aria-label="zh ? '项目流程图' : 'Project story graph'" :aria-busy="flowStore.loading">
    <ProjectFlowToolbar
      :graph="flowStore.graph" :view="flowStore.currentView" :direction="flowStore.direction" :zh="zh" :busy="busy" :available="!!project.project"
      @navigate="navigateTo" @back="flowStore.back" @refresh="refreshData" @layout="layoutGraph" @details="showDetails" @page="flowStore.setPage"
    />
    <p v-if="flowStore.graph" class="flow-summary" data-flow-summary>
      <span>{{ flowStore.graph.counts.chapters }} {{ zh ? '章节' : 'chapters' }} · {{ flowStore.graph.counts.choices }} {{ zh ? '选项' : 'choices' }}</span>
      <span v-if="flowStore.currentView">{{ zh ? '当前显示' : 'Visible' }} {{ flowStore.visibleNodes.length }} {{ zh ? '节点' : 'nodes' }}</span>
      <span>{{ zh ? '静态可达' : 'Statically reachable' }} {{ flowStore.graph.counts.reachable }} / {{ flowStore.graph.counts.storyNodes + flowStore.graph.counts.choices }}</span>
      <span v-if="flowStore.graph.counts.unreachable">{{ zh ? '不可达' : 'Unreachable' }} {{ flowStore.graph.counts.unreachable }}</span>
      <span v-if="flowStore.graph.counts.unknown">{{ zh ? '未知' : 'Unknown' }} {{ flowStore.graph.counts.unknown }}</span>
    </p>
    <p v-if="navigation.error.value || refreshError || flowStore.error" class="flow-message flow-error" role="alert">
      {{ navigation.error.value || refreshError || flowStore.error }}
    </p>
    <p v-if="flowStore.loading" class="flow-message" role="status">
      {{ zh ? '正在更新项目流程图…' : 'Updating story graph…' }}
    </p>
    <p v-else-if="!project.project" class="flow-message" role="status">
      {{ zh ? '打开项目后查看章节与分支关系。' : 'Open a project to view its chapters and branches.' }}
    </p>
    <p v-else-if="flowStore.graph?.status === 'invalid'" class="flow-message" role="status">
      {{ zh ? '项目编译未通过，先定位并修复诊断；当前只展示可确认的章节。' : 'Compilation failed. Open the diagnostics to fix the project; only known chapters are shown.' }}
    </p>
    <p v-else-if="flowStore.graph?.status === 'empty'" class="flow-message" role="status">
      {{ zh ? '项目尚无可展示的剧情节点。' : 'No story nodes are available in this project.' }}
    </p>
    <VueFlow
      v-if="flowStore.visibleNodes.length"
      :id="flow.id"
      :nodes="flowStore.visibleNodes"
      :edges="displayEdges"
      :default-viewport="flowStore.viewport"
      class="flow-canvas"
      :min-zoom="minZoom"
      :max-zoom="4"
      :nodes-draggable="false"
      :nodes-connectable="false"
      :elements-selectable="false"
      @edge-click="inspectEdge"
    >
      <Background pattern-color="var(--agui-c-divider)" :gap="16" />

      <MiniMap v-if="visible && flowStore.visibleNodes.length > 10" mask-color="var(--agui-c-divider-light)" node-color="var(--agui-c-text-2)" />

      <Controls position="bottom-left" :show-interactive="false">
        <template #control-zoom-in>
          <AGUIIconButton class="vue-flow__controls-zoomin" icon="i-ri-add-line" :title="zh ? '放大' : 'Zoom in'" :disabled="flowStore.viewport.zoom >= 4" @click="flow.zoomIn()" />
        </template>
        <template #control-zoom-out>
          <AGUIIconButton class="vue-flow__controls-zoomout" icon="i-ri-subtract-line" :title="zh ? '缩小' : 'Zoom out'" :disabled="flowStore.viewport.zoom <= minZoom" @click="flow.zoomOut()" />
        </template>
        <template #control-fit-view>
          <AGUIIconButton class="vue-flow__controls-fitview" icon="i-ri-focus-3-line" :title="zh ? '显示全部节点' : 'Fit visible nodes'" @click="fitVisibleNodes" />
        </template>
      </Controls>
      <template #node-project-story="{ data }">
        <ProjectFlowNode :data="data" :source-position="sourcePosition" :target-position="targetPosition" :zh="zh" :busy="busy" @open="openSource(data.source)" @expand="flowStore.expandNode(data)" @inspect="inspectNode(data)" />
      </template>
    </VueFlow>
    <ProjectFlowRoutes :edge="selectedRoutes" :zh="zh" :busy="busy" @open="openSource" @navigate="navigateTo" @close="selectedRoutes = undefined; fitResizedCanvas()" @toggle="fitResizedCanvas" />
    <ProjectFlowDiagnostics :diagnostics="flowStore.graph?.diagnostics ?? []" :zh="zh" :busy="busy" @open="openDiagnostic" @toggle="fitResizedCanvas" />
  </section>
</template>

<style scoped>
.advjs-flow-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  container-type: inline-size;
  background: var(--agui-c-bg-soft);
  color: var(--agui-c-text-1);
}
.flow-canvas {
  flex: 1;
  min-height: 100px;
}
.flow-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin: 0;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--agui-c-text-2);
  border-bottom: 1px solid var(--agui-c-divider);
}
.flow-message {
  padding: 8px;
  margin: 0;
  font-size: 12px;
  overflow-wrap: anywhere;
  color: var(--agui-c-text-2);
}
.flow-error {
  color: var(--agui-c-danger-text);
}
:deep(.vue-flow__edge-path) {
  stroke: var(--agui-c-text-2);
}
:deep(.project-flow-edge-conditional .vue-flow__edge-path) {
  stroke-dasharray: 4 3;
}
:deep(.project-flow-edge-summary .vue-flow__edge-path) {
  stroke-dasharray: 2 4;
}
:deep(.vue-flow__edge-text) {
  fill: var(--agui-c-text-1);
  font-size: 12px;
}
:deep(.vue-flow__edge-textbg) {
  fill: var(--agui-c-bg-panel);
}
:deep(.vue-flow__controls) {
  display: flex;
  background: var(--agui-c-bg-panel);
  box-shadow: none;
  border: 1px solid var(--agui-c-divider);
}
:deep(.vue-flow__minimap) {
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-divider);
}
@container (max-width: 520px) {
  :deep(.vue-flow__minimap) {
    display: none;
  }
}
</style>
