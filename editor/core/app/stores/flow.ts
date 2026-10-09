import type { Edge, Node, ViewportTransform } from '@vue-flow/core'
import type { EditorProjectModel } from '../adapters/browser/project'
import type { FindFlowNode, FlowLayoutDirection } from '../composables/flow/useFlowLayout'
import type { ProjectFlowGraph } from '../utils/project-flow'
import type { ProjectFlowView, ProjectFlowViewNode, ProjectFlowViewSelection } from '../utils/project-flow-view'
import { MarkerType } from '@vue-flow/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, onScopeDispose, shallowRef } from 'vue'
import { useFlowLayout } from '../composables/flow/useFlowLayout'
import { createProjectFlowBuilder } from '../utils/project-flow'
import { buildProjectFlowView } from '../utils/project-flow-view'

interface RememberedView {
  signature: string
  positions: Map<string, Node['position']>
  direction: FlowLayoutDirection
  viewport: ViewportTransform
  laidOut: boolean
  returnTo?: ProjectFlowViewSelection
}
const MAX_REMEMBERED_VIEWS = 32
const initialViewport = () => ({ x: 0, y: 0, zoom: 1 })

/** Presentation state only. Runtime nodes, files and chapter structure stay intact. */
export const useFlowStore = defineStore('flow', () => {
  const layoutEngine = useFlowLayout()
  const builder = createProjectFlowBuilder()
  const graph = shallowRef<ProjectFlowGraph>()
  const currentView = shallowRef<ProjectFlowView>()
  const selection = shallowRef<ProjectFlowViewSelection>({ level: 'chapters' })
  // Keep thousands of canonical nodes outside Vue's deep dependency graph. Only
  // the bounded projection for the current page is handed to Vue Flow.
  const nodes = shallowRef<Node<ProjectFlowViewNode>[]>([])
  const edges = shallowRef<Edge[]>([])
  const viewport = shallowRef<ViewportTransform>(initialViewport())
  const direction = shallowRef<FlowLayoutDirection>('LR')
  const loading = shallowRef(false)
  const error = shallowRef('')
  const revision = shallowRef(0)
  const requiresFit = shallowRef(true)
  const remembered = new Map<string, RememberedView>()
  const rememberedCount = shallowRef(0)
  const sourceStats = shallowRef(builder.stats)
  const cacheStats = computed(() => ({ ...layoutEngine.stats.value, ...sourceStats.value, rememberedViews: rememberedCount.value }))
  const chapterFilter = computed({
    get: () => selection.value.chapterId ?? '',
    set: (id: string) => { id ? selectChapter(id) : showOverview() },
  })
  const visibleNodes = computed(() => nodes.value)
  const visibleEdges = computed(() => edges.value)
  const breadcrumbs = computed(() => currentView.value?.breadcrumbs ?? [])
  let workspace: unknown
  let generation = 0
  let signature = ''
  let laidOut = false
  let returnTo: ProjectFlowViewSelection | undefined

  function rememberCurrentView() {
    if (!currentView.value)
      return
    remembered.delete(currentView.value.key)
    remembered.set(currentView.value.key, {
      signature,
      positions: new Map(nodes.value.map(node => [node.id, { ...node.position }])),
      direction: direction.value,
      viewport: { ...viewport.value },
      laidOut,
      returnTo,
    })
    while (remembered.size > MAX_REMEMBERED_VIEWS)
      remembered.delete(remembered.keys().next().value!)
    rememberedCount.value = remembered.size
  }

  function clear() {
    graph.value = undefined
    currentView.value = undefined
    selection.value = { level: 'chapters' }
    nodes.value = []
    edges.value = []
    viewport.value = initialViewport()
    direction.value = 'LR'
    error.value = ''
    signature = ''
    laidOut = false
    returnTo = undefined
    requiresFit.value = true
    remembered.clear()
    rememberedCount.value = 0
    layoutEngine.clear()
    builder.clear()
    sourceStats.value = builder.stats
    revision.value++
  }

  function present(next: ProjectFlowViewSelection, remember = true) {
    if (!graph.value)
      return
    if (remember)
      rememberCurrentView()
    const previousSelection = selection.value
    const previousReturnTo = returnTo
    const projected = buildProjectFlowView(graph.value, next)
    // Hash only content rendered in this view. Routes and aggregate member ids
    // can reference an entire chapter; they are refreshed as data below, but
    // never duplicated in each remembered layout signature.
    const nextSignature = JSON.stringify([
      projected.nodes.map(node => [
        node.id,
        node.kind,
        node.runtimeKind,
        node.label,
        node.reachability,
        node.isEntry,
        node.conditional,
        node.diagnostics.length,
        node.portal,
        node.overflow,
        node.overflowKind,
        node.aggregate ? [node.aggregate.storyNodes, node.aggregate.choices, node.aggregate.endings, node.aggregate.sections] : undefined,
      ]),
      projected.edges.map(edge => [edge.id, edge.source, edge.target, edge.kind, edge.label, edge.conditional, edge.crossChapter, edge.summary]),
    ])
    const cached = remembered.get(projected.key)
    const reusable = cached?.signature === nextSignature ? cached : undefined
    // Whole-chapter detail opened from a later section page should return to
    // that page, even while paging through the chapter's individual nodes.
    returnTo = projected.selection.level === 'details'
      ? previousSelection.level === 'sections' && previousSelection.chapterId === projected.selection.chapterId
        ? previousSelection
        : previousSelection.level === 'details' && previousSelection.chapterId === projected.selection.chapterId && previousSelection.sectionId === projected.selection.sectionId
          ? previousReturnTo
          : reusable?.returnTo
      : undefined
    currentView.value = projected
    selection.value = projected.selection
    signature = nextSignature
    direction.value = reusable?.direction ?? 'LR'
    viewport.value = reusable ? { ...reusable.viewport } : initialViewport()
    laidOut = reusable?.laidOut ?? false
    requiresFit.value = !laidOut
    nodes.value = projected.nodes.map(node => ({
      id: node.id,
      type: 'project-story',
      data: node,
      position: reusable?.positions.get(node.id) ? { ...reusable.positions.get(node.id)! } : { x: 0, y: 0 },
      style: { width: '210px' },
    }))
    edges.value = projected.edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      data: edge,
      markerEnd: edge.summary ? undefined : MarkerType.ArrowClosed,
      class: edge.summary ? 'project-flow-edge-summary' : edge.conditional || edge.crossChapter ? 'project-flow-edge-conditional' : '',
    }))
    revision.value++
  }

  async function loadProject(model: EditorProjectModel | undefined, identity: unknown) {
    const request = ++generation
    if (workspace !== identity) {
      workspace = identity
      clear()
    }
    if (!model) {
      clear()
      loading.value = false
      return
    }
    loading.value = true
    error.value = ''
    try {
      const projected = await builder.buildProjectFlow(model)
      if (request !== generation)
        return
      rememberCurrentView()
      graph.value = projected
      sourceStats.value = builder.stats
      present(selection.value, false)
    }
    catch (cause) {
      if (request !== generation)
        return
      clear()
      error.value = cause instanceof Error ? cause.message : String(cause)
    }
    finally {
      if (request === generation)
        loading.value = false
    }
  }

  function navigateTo(next: ProjectFlowViewSelection) {
    present(next)
  }
  function showOverview() {
    navigateTo({ level: 'chapters' })
  }
  function selectChapter(chapterId: string) {
    navigateTo({ level: 'sections', chapterId })
  }
  function showDetails(chapterId = selection.value.chapterId, sectionId?: string) {
    navigateTo({ level: 'details', chapterId, sectionId })
  }
  function showAll() {
    navigateTo({ level: 'all' })
  }
  function expandNode(node: ProjectFlowViewNode | string) {
    const data = typeof node === 'string' ? currentView.value?.nodes.find(item => item.id === node) : node
    if (data?.expandTo)
      navigateTo(data.expandTo)
  }
  function setPage(page: number) {
    navigateTo({ ...selection.value, page })
  }
  function back() {
    navigateTo(returnTo ?? currentView.value?.breadcrumbs.at(-2)?.selection ?? { level: 'chapters' })
  }
  function setViewport(next: ViewportTransform, viewKey = currentView.value?.key) {
    if (viewKey !== currentView.value?.key)
      return
    viewport.value = { ...next }
  }

  function layoutGraph(nextDirection: FlowLayoutDirection, findNode?: FindFlowNode, force = false) {
    const runs = layoutEngine.stats.value.runs
    const before = nodes.value
    nodes.value = layoutEngine.layout(before, edges.value.filter(edge => !edge.data?.summary), nextDirection, findNode, force) as Node<ProjectFlowViewNode>[]
    const changed = direction.value !== nextDirection || before.some((node, index) => node.position.x !== nodes.value[index]?.position.x || node.position.y !== nodes.value[index]?.position.y)
    direction.value = nextDirection
    laidOut = true
    requiresFit.value = requiresFit.value || changed || force
    rememberCurrentView()
    return { cacheHit: layoutEngine.stats.value.runs === runs, changed }
  }

  function didFit() {
    requiresFit.value = false
    rememberCurrentView()
  }

  onScopeDispose(() => {
    generation++
    remembered.clear()
    builder.clear()
    layoutEngine.clear()
  })
  return {
    graph,
    currentView,
    selection,
    nodes,
    edges,
    visibleNodes,
    visibleEdges,
    viewport,
    direction,
    chapterFilter,
    breadcrumbs,
    loading,
    error,
    revision,
    requiresFit,
    cacheStats,
    loadProject,
    layoutGraph,
    navigateTo,
    showOverview,
    selectChapter,
    showDetails,
    showAll,
    expandNode,
    setPage,
    back,
    setViewport,
    didFit,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useFlowStore, import.meta.hot))
