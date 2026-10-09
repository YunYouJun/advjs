import type { ProjectFlowEdge, ProjectFlowGraph, ProjectFlowNode, ProjectFlowReachability, ProjectFlowSource } from './project-flow'
import { projectFlowChapterId, projectFlowStoryId } from './project-flow'

/** Presentation only: runtime addresses and the linked graph are never rewritten. */
export interface ProjectFlowViewSelection {
  readonly level: 'chapters' | 'sections' | 'details' | 'all'
  readonly chapterId?: string
  readonly sectionId?: string
  readonly page?: number
}

export interface ProjectFlowSection {
  readonly id: string
  readonly chapterId: string
  readonly label: string
  readonly nodeIds: readonly string[]
  readonly entryNodeId: string
  readonly source?: ProjectFlowSource
}

export interface ProjectFlowAggregate {
  readonly storyNodes: number
  readonly choices: number
  readonly endings: number
  readonly sections: number
  readonly nodeIds: readonly string[]
}

export interface ProjectFlowViewNode extends Omit<ProjectFlowNode, 'kind'> {
  readonly kind: ProjectFlowNode['kind'] | 'section'
  readonly aggregate?: ProjectFlowAggregate
  readonly expandTo?: ProjectFlowViewSelection
  readonly portal?: boolean
  /** The related edges expose each actual destination, rather than one guessed target. */
  readonly overflow?: boolean
  readonly overflowKind?: 'destinations' | 'connections'
}

export interface ProjectFlowViewRoute {
  readonly edge: ProjectFlowEdge
  readonly source: ProjectFlowNode
  readonly target: ProjectFlowNode
  readonly sourceSelection: ProjectFlowViewSelection
  readonly targetSelection: ProjectFlowViewSelection
}

export interface ProjectFlowViewEdge extends ProjectFlowEdge {
  readonly routes: readonly ProjectFlowViewRoute[]
  /** An inspectable collection of omitted visible connections, not a runtime cycle. */
  readonly summary?: boolean
}

export interface ProjectFlowViewBreadcrumb {
  readonly label: string
  readonly selection: ProjectFlowViewSelection
}

export interface ProjectFlowView {
  readonly key: string
  readonly selection: ProjectFlowViewSelection
  readonly nodes: readonly ProjectFlowViewNode[]
  readonly edges: readonly ProjectFlowViewEdge[]
  readonly sections: readonly ProjectFlowSection[]
  readonly breadcrumbs: readonly ProjectFlowViewBreadcrumb[]
  readonly page: number
  readonly pageCount: number
  readonly pageSize: number
  /** Canonical items at the selected level, excluding folded boundary portals. */
  readonly totalNodes: number
}

export const PROJECT_FLOW_VIEW_PAGE_SIZE = 200
export const PROJECT_FLOW_VIEW_PORTAL_LIMIT = 40
export const PROJECT_FLOW_VIEW_EDGE_LIMIT = 600
const VIEW_CACHE_LIMIT = 24

interface FlowIndex {
  nodes: Map<string, ProjectFlowNode>
  positions: Map<string, number>
  sections: ProjectFlowSection[]
  sectionsByChapter: Map<string, ProjectFlowSection[]>
  sectionByNode: Map<string, ProjectFlowSection>
  sectionById: Map<string, ProjectFlowSection>
  sectionPositions: Map<string, number>
  sectionOrdinals: Map<string, number>
  chapterOrdinals: Map<string, number>
  chapterNodes: Map<string, ProjectFlowViewNode>
  sectionNodes: Map<string, ProjectFlowViewNode>
  nodeEdges: Map<string, ProjectFlowEdge[]>
  chapterEdges: ProjectFlowEdge[]
  chapterIncidentEdges: Map<string, ProjectFlowEdge[]>
  items: Map<string, readonly ProjectFlowViewNode[]>
  views: Map<string, ProjectFlowView>
}

const indexes = new WeakMap<ProjectFlowGraph, FlowIndex>()

export function projectFlowSectionId(chapterId: string, startNodeId: string): string {
  return `section:${encodeURIComponent(chapterId)}:${encodeURIComponent(startNodeId)}`
}

function summary(nodes: readonly ProjectFlowNode[], sectionCount: number): ProjectFlowAggregate {
  let storyNodes = 0
  let choices = 0
  let endings = 0
  for (const node of nodes) {
    if (node.kind === 'story')
      storyNodes++
    if (node.kind === 'choice')
      choices++
    if (node.runtimeKind === 'end')
      endings++
  }
  return { storyNodes, choices, endings, sections: sectionCount, nodeIds: nodes.map(node => node.id) }
}

function reachability(nodes: readonly ProjectFlowNode[]): ProjectFlowReachability {
  if (nodes.some(node => node.reachability === 'reachable'))
    return 'reachable'
  return !nodes.length || nodes.some(node => node.reachability === 'unknown') ? 'unknown' : 'unreachable'
}

function aggregateNode(id: string, kind: 'chapter' | 'section', label: string, chapterId: string, nodes: readonly ProjectFlowNode[], sections: number, fallback?: ProjectFlowNode): ProjectFlowViewNode {
  const first = nodes[0] ?? fallback
  return {
    id,
    kind,
    label,
    chapterId,
    source: first?.source,
    address: first?.address,
    diagnostics: [...new Set(nodes.flatMap(node => node.diagnostics).concat(fallback?.diagnostics ?? []))],
    reachability: nodes.length ? reachability(nodes) : fallback?.reachability ?? 'unknown',
    isEntry: nodes.some(node => node.isEntry) || Boolean(fallback?.isEntry),
    conditional: nodes.some(node => node.conditional),
    aggregate: summary(nodes, sections),
  }
}

function fileLabel(source: ProjectFlowSource | undefined, chapterTitle: string): string {
  return source?.path.split('/').at(-1)?.replace(/\.adv\.md$|\.md$/i, '') || chapterTitle
}

function indexGraph(graph: ProjectFlowGraph): FlowIndex {
  const cached = indexes.get(graph)
  if (cached)
    return cached
  const nodes = new Map(graph.nodes.map(node => [node.id, node]))
  const index: FlowIndex = {
    nodes,
    positions: new Map(graph.nodes.map((node, position) => [node.id, position])),
    sections: [],
    sectionsByChapter: new Map(),
    sectionByNode: new Map(),
    sectionById: new Map(),
    sectionPositions: new Map(),
    sectionOrdinals: new Map(),
    chapterOrdinals: new Map(),
    chapterNodes: new Map(),
    sectionNodes: new Map(),
    nodeEdges: new Map(),
    chapterEdges: [],
    chapterIncidentEdges: new Map(),
    items: new Map(),
    views: new Map(),
  }
  for (const chapter of graph.chapters) {
    const members = chapter.nodeIds.flatMap(id => nodes.get(id) ? [nodes.get(id)!] : [])
    const sections: ProjectFlowSection[] = []
    let current: { id: string, chapterId: string, label: string, nodeIds: string[], entryNodeId: string, source?: ProjectFlowSource } | undefined
    let headingOnlySetup = false
    let previousPath: string | undefined
    const start = (node: ProjectFlowNode, label: string, heading = false) => {
      current = { id: projectFlowSectionId(chapter.id, node.id), chapterId: chapter.id, label, nodeIds: [], entryNodeId: node.id, source: node.source }
      sections.push(current)
      headingOnlySetup = heading
    }
    for (const node of members) {
      if (node.kind === 'choice') {
        const owner = node.address ? index.sectionByNode.get(projectFlowStoryId(node.address)) : undefined
        if (owner) {
          ;(owner.nodeIds as string[]).push(node.id)
          index.sectionByNode.set(node.id, owner)
          continue
        }
      }
      const heading = node.kind === 'story' && node.runtimeKind === 'anchor' && (node.headingDepth === undefined || node.headingDepth <= 2)
      const scene = node.kind === 'story' && node.runtimeKind === 'scene'
      const changedFile = node.source?.path !== undefined && previousPath !== undefined && node.source.path !== previousPath
      // A heading followed by its declarative scene/setup is one useful block.
      const adjoiningScene = scene && headingOnlySetup && !changedFile
      if (!current || heading || (scene && !adjoiningScene) || changedFile)
        start(node, heading || scene ? node.label : fileLabel(node.source, chapter.title), heading)
      current!.nodeIds.push(node.id)
      index.sectionByNode.set(node.id, current!)
      previousPath = node.source?.path ?? previousPath
      if (!['anchor', 'actions', 'effects'].includes(node.runtimeKind ?? ''))
        headingOnlySetup = false
    }
    index.sectionsByChapter.set(chapter.id, sections)
    for (const [ordinal, section] of sections.entries()) {
      index.sections.push(section)
      index.sectionById.set(section.id, section)
      index.sectionOrdinals.set(section.id, ordinal)
      section.nodeIds.forEach((id, position) => index.sectionPositions.set(id, position))
      const sectionMembers = section.nodeIds.map(id => nodes.get(id)!)
      index.sectionNodes.set(section.id, {
        ...aggregateNode(section.id, 'section', section.label, chapter.id, sectionMembers, 1),
        expandTo: { level: 'details', chapterId: chapter.id, sectionId: section.id, page: 0 },
      })
    }
    const header = nodes.get(projectFlowChapterId(chapter.id))
    index.chapterOrdinals.set(chapter.id, index.chapterNodes.size)
    index.chapterNodes.set(chapter.id, {
      ...aggregateNode(projectFlowChapterId(chapter.id), 'chapter', chapter.title, chapter.id, members, sections.length, header),
      // Chapter source navigation remains the actual chapter entry, not a guessed jump target.
      source: header?.source,
      address: chapter.entryNodeId ? nodes.get(chapter.entryNodeId)?.address : undefined,
      expandTo: { level: 'sections', chapterId: chapter.id, page: 0 },
    })
  }
  const push = (map: Map<string, ProjectFlowEdge[]>, id: string, edge: ProjectFlowEdge) => {
    const edges = map.get(id) ?? []
    edges.push(edge)
    map.set(id, edges)
  }
  for (const edge of graph.edges) {
    const source = nodes.get(edge.source)
    const target = nodes.get(edge.target)
    if (!source || !target)
      continue
    push(index.nodeEdges, edge.source, edge)
    if (edge.target !== edge.source)
      push(index.nodeEdges, edge.target, edge)
    push(index.chapterIncidentEdges, source.chapterId, edge)
    if (target.chapterId !== source.chapterId) {
      push(index.chapterIncidentEdges, target.chapterId, edge)
      index.chapterEdges.push(edge)
    }
  }
  indexes.set(graph, index)
  return index
}

export function getProjectFlowSections(graph: ProjectFlowGraph, chapterId?: string): readonly ProjectFlowSection[] {
  const index = indexGraph(graph)
  return chapterId === undefined ? index.sections : index.sectionsByChapter.get(chapterId) ?? []
}

/** Find the precise detail page for an authored node, including choice source positions. */
export function projectFlowNodeSelection(graph: ProjectFlowGraph, nodeId: string): ProjectFlowViewSelection {
  const index = indexGraph(graph)
  const node = index.nodes.get(nodeId)
  const section = index.sectionByNode.get(nodeId)
  return section
    ? { level: 'details', chapterId: section.chapterId, sectionId: section.id, page: Math.floor((index.sectionPositions.get(nodeId) ?? 0) / PROJECT_FLOW_VIEW_PAGE_SIZE) }
    : node ? { level: 'sections', chapterId: node.chapterId, page: 0 } : { level: 'chapters', page: 0 }
}

function normalizeSelection(index: FlowIndex, requested: ProjectFlowViewSelection): ProjectFlowViewSelection {
  if (requested.level === 'all')
    return { level: 'all', page: requested.page }
  if (requested.level === 'chapters' || !requested.chapterId || !index.chapterNodes.has(requested.chapterId))
    return { level: 'chapters', page: requested.page }
  if (requested.level === 'details') {
    if (!requested.sectionId)
      return { level: 'details', chapterId: requested.chapterId, page: requested.page }
    const section = index.sectionById.get(requested.sectionId)
    if (section?.chapterId === requested.chapterId)
      return { level: 'details', chapterId: requested.chapterId, sectionId: section.id, page: requested.page }
  }
  return { level: 'sections', chapterId: requested.chapterId, page: requested.page }
}

/** At most 200 canonical items plus 40 folded portals are mounted in any view. */
export function buildProjectFlowView(graph: ProjectFlowGraph, requested: ProjectFlowViewSelection = { level: 'chapters' }): ProjectFlowView {
  const index = indexGraph(graph)
  const normalized = normalizeSelection(index, requested)
  const section = normalized.sectionId ? index.sectionById.get(normalized.sectionId) : undefined
  const itemsKey = `${normalized.level}:${normalized.chapterId ?? ''}:${normalized.sectionId ?? ''}`
  let items = index.items.get(itemsKey)
  if (!items) {
    const allItems: readonly ProjectFlowViewNode[] = normalized.level === 'chapters'
      ? [...index.chapterNodes.values()]
      : normalized.level === 'sections'
        ? (index.sectionsByChapter.get(normalized.chapterId!) ?? []).map(section => index.sectionNodes.get(section.id)!)
        : normalized.level === 'details'
          ? (section?.nodeIds ?? index.chapterNodes.get(normalized.chapterId!)?.aggregate?.nodeIds ?? []).map(id => index.nodes.get(id)!)
          : graph.nodes
    items = allItems.length || normalized.level !== 'sections' ? allItems : [index.chapterNodes.get(normalized.chapterId!)!]
    index.items.set(itemsKey, items)
  }
  const pageCount = Math.max(1, Math.ceil(items.length / PROJECT_FLOW_VIEW_PAGE_SIZE))
  const page = Math.max(0, Math.min(pageCount - 1, Number.isFinite(normalized.page) ? Math.trunc(normalized.page!) : 0))
  const selection = { ...normalized, page }
  const key = JSON.stringify(selection)
  const cached = index.views.get(key)
  if (cached) {
    index.views.delete(key)
    index.views.set(key, cached)
    return cached
  }
  const visible = items.slice(page * PROJECT_FLOW_VIEW_PAGE_SIZE, (page + 1) * PROJECT_FLOW_VIEW_PAGE_SIZE)
  const visibleById = new Map(visible.map(node => [node.id, node]))
  const candidates = normalized.level === 'chapters'
    ? index.chapterEdges
    : normalized.level === 'sections'
      ? index.chapterIncidentEdges.get(normalized.chapterId!) ?? []
      : [...new Set(visible.flatMap(node => index.nodeEdges.get(node.id) ?? []))]
  const portals = new Map<string, ProjectFlowViewNode>()
  const destination = (node: ProjectFlowNode): ProjectFlowViewNode | undefined => {
    let projected: ProjectFlowViewNode | undefined
    if (normalized.level === 'chapters') {
      projected = index.chapterNodes.get(node.chapterId)
    }
    else if (normalized.level === 'sections' && node.chapterId === normalized.chapterId) {
      const ownerSection = index.sectionByNode.get(node.id)
      projected = ownerSection ? index.sectionNodes.get(ownerSection.id) : undefined
    }
    else if (normalized.level === 'details' || normalized.level === 'all') {
      if (visibleById.has(node.id))
        return visibleById.get(node.id)
      const ownerSection = index.sectionByNode.get(node.id)
      const targetSelection = normalized.level === 'all'
        ? { level: 'all' as const, page: Math.floor((index.positions.get(node.id) ?? 0) / PROJECT_FLOW_VIEW_PAGE_SIZE) }
        : projectFlowNodeSelection(graph, node.id)
      const base = ownerSection ? index.sectionNodes.get(ownerSection.id) : index.chapterNodes.get(node.chapterId)
      if (!base)
        return undefined
      const targetPage = targetSelection.page ?? 0
      const label = node.chapterId === normalized.chapterId ? base.label : `${index.chapterNodes.get(node.chapterId)?.label ?? node.chapterId} · ${base.label}`
      projected = { ...base, id: `portal:${base.id}:page:${targetPage}`, kind: node.chapterId === normalized.chapterId ? 'section' : 'chapter', label: `${label}${targetPage ? ` · ${targetPage + 1}` : ''}`, source: node.source, address: node.address, expandTo: targetSelection }
    }
    else {
      const targetSelection = projectFlowNodeSelection(graph, node.id)
      const ownerSection = index.sectionByNode.get(node.id)
      const base = index.chapterNodes.get(node.chapterId)
      if (base) {
        const label = ownerSection && ownerSection.label !== base.label ? `${base.label} · ${ownerSection.label}` : base.label
        projected = { ...base, id: `portal:${base.id}:${ownerSection?.id ?? 'entry'}:page:${targetSelection.page ?? 0}`, label, source: node.source, address: node.address, expandTo: targetSelection }
      }
    }
    if (!projected)
      return undefined
    if (visibleById.has(projected.id))
      return visibleById.get(projected.id)
    const cached = portals.get(projected.id)
    if (cached)
      return cached
    const portal = { ...projected, portal: true }
    portals.set(portal.id, portal)
    return portal
  }
  const projectedRoutes: Array<{ source: string, target: string, route: ProjectFlowViewRoute }> = []
  for (const edge of candidates) {
    if (normalized.level !== 'all' && edge.kind === 'chapter-entry')
      continue
    const sourceNode = index.nodes.get(edge.source)!
    const targetNode = index.nodes.get(edge.target)!
    const source = destination(sourceNode)
    const target = destination(targetNode)
    if (!source || !target || (!visibleById.has(source.id) && !visibleById.has(target.id)))
      continue
    if (source.id === target.id && normalized.level !== 'details' && normalized.level !== 'all') {
      // Only retain backward authored jumps as collapsed loops; ordinary internal
      // next/choice links must not invent a cycle in a chapter or section overview.
      if (normalized.level === 'chapters' || edge.kind !== 'jump' || (index.positions.get(edge.target) ?? 0) > (index.positions.get(edge.source) ?? 0))
        continue
    }
    projectedRoutes.push({ source: source.id, target: target.id, route: { edge, source: sourceNode, target: targetNode, sourceSelection: projectFlowNodeSelection(graph, sourceNode.id), targetSelection: projectFlowNodeSelection(graph, targetNode.id) } })
  }
  const usedPortals = new Set(projectedRoutes.flatMap(route => [route.source, route.target]).filter(id => portals.has(id)))
  const portalNodes = [...portals.values()].filter(node => usedPortals.has(node.id))
  // Dense chapter/section summaries can otherwise mount tens of thousands of
  // SVG paths despite their bounded node count. Reserve one boundary slot for
  // an inspectable connection collection if the projected pairs exceed budget.
  const dense = new Set(projectedRoutes.map(route => `${route.source}->${route.target}`)).size > PROJECT_FLOW_VIEW_EDGE_LIMIT
  const portalLimit = PROJECT_FLOW_VIEW_PORTAL_LIMIT - Number(dense)
  const overflowIds = new Set(portalNodes.slice(portalLimit - 1).map(node => node.id))
  const hasOverflow = portalNodes.length > portalLimit
  const overflowId = `portal:overflow:${key}`
  const renderedPortals: ProjectFlowViewNode[] = hasOverflow ? portalNodes.slice(0, portalLimit - 1) : portalNodes
  if (hasOverflow) {
    const omitted = portalNodes.filter(node => overflowIds.has(node.id))
    const memberIds = [...new Set(projectedRoutes.flatMap(route => [
      ...(overflowIds.has(route.source) ? [route.route.source.id] : []),
      ...(overflowIds.has(route.target) ? [route.route.target.id] : []),
    ]))]
    const members = memberIds.map(id => index.nodes.get(id)!).filter(Boolean)
    renderedPortals.push({ ...aggregateNode(overflowId, 'section', `其他跳转目标（${omitted.length}处）`, normalized.chapterId ?? '', members, omitted.length), portal: true, overflow: true, overflowKind: 'destinations', source: undefined, address: undefined })
  }
  const endpoints = (id: string) => hasOverflow && overflowIds.has(id) ? overflowId : id
  const edgeBuckets = new Map<string, { source: string, target: string, routes: ProjectFlowViewRoute[] }>()
  for (const route of projectedRoutes) {
    const source = endpoints(route.source)
    const target = endpoints(route.target)
    const id = `${source}->${target}`
    const bucket = edgeBuckets.get(id) ?? { source, target, routes: [] }
    bucket.routes.push(route.route)
    edgeBuckets.set(id, bucket)
  }
  const edgeEntries = [...edgeBuckets.entries()]
  const hasConnectionOverflow = edgeEntries.length > PROJECT_FLOW_VIEW_EDGE_LIMIT
  const edges = edgeEntries.slice(0, hasConnectionOverflow ? PROJECT_FLOW_VIEW_EDGE_LIMIT - 1 : undefined).map(([id, bucket]): ProjectFlowViewEdge => ({
    id: `view:${id}`,
    source: bucket.source,
    target: bucket.target,
    kind: bucket.routes.some(route => route.edge.kind === 'jump') ? 'jump' : bucket.routes[0].edge.kind,
    label: bucket.routes.length > 1 ? `${bucket.routes.length} 条跳转` : bucket.routes[0].edge.label,
    conditional: bucket.routes.some(route => route.edge.conditional),
    crossChapter: bucket.routes.some(route => route.edge.crossChapter),
    routes: bucket.routes,
  }))
  if (hasConnectionOverflow) {
    const routes = edgeEntries.slice(PROJECT_FLOW_VIEW_EDGE_LIMIT - 1).flatMap(([, bucket]) => bucket.routes)
    const members = [...new Map(routes.flatMap(route => [[route.source.id, route.source], [route.target.id, route.target]] as const)).values()]
    const id = `portal:connections:${key}`
    renderedPortals.push({ ...aggregateNode(id, 'section', `其他连接（${routes.length}条）`, normalized.chapterId ?? '', members, 0), portal: true, overflow: true, overflowKind: 'connections', source: undefined, address: undefined })
    edges.push({ id: `view:connections:${key}`, source: id, target: id, kind: 'fallback', label: `汇总 ${routes.length} 条连接`, conditional: routes.some(route => route.edge.conditional), crossChapter: routes.some(route => route.edge.crossChapter), routes, summary: true })
  }
  const chapterPage = normalized.chapterId ? Math.floor((index.chapterOrdinals.get(normalized.chapterId) ?? 0) / PROJECT_FLOW_VIEW_PAGE_SIZE) : 0
  const parentSection = section ?? (normalized.level === 'details' && visible[0] ? index.sectionByNode.get(visible[0].id) : undefined)
  const sectionPage = parentSection ? Math.floor((index.sectionOrdinals.get(parentSection.id) ?? 0) / PROJECT_FLOW_VIEW_PAGE_SIZE) : 0
  const breadcrumbs: ProjectFlowViewBreadcrumb[] = [{ label: '章节概览', selection: { level: 'chapters', page: chapterPage } }]
  if (normalized.chapterId) {
    breadcrumbs.push({ label: index.chapterNodes.get(normalized.chapterId)!.label, selection: { level: 'sections', chapterId: normalized.chapterId, page: normalized.level === 'sections' ? page : sectionPage } })
    if (section)
      breadcrumbs.push({ label: section.label, selection: { level: 'details', chapterId: normalized.chapterId, sectionId: section.id, page: 0 } })
    else if (normalized.level === 'details')
      breadcrumbs.push({ label: '剧情详情', selection: { level: 'details', chapterId: normalized.chapterId, page } })
  }
  else if (normalized.level === 'all') {
    breadcrumbs.push({ label: '全部剧情', selection: { level: 'all', page: 0 } })
  }
  const view: ProjectFlowView = { key, selection, nodes: [...visible, ...renderedPortals], edges, sections: normalized.chapterId ? index.sectionsByChapter.get(normalized.chapterId) ?? [] : index.sections, breadcrumbs, page, pageCount, pageSize: PROJECT_FLOW_VIEW_PAGE_SIZE, totalNodes: items.length }
  index.views.set(key, view)
  if (index.views.size > VIEW_CACHE_LIMIT)
    index.views.delete(index.views.keys().next().value!)
  return view
}
