import type { GraphNode } from '@vue-flow/core'
import type { EditorProjectModel } from '../../../editor/core/app/adapters/browser/project'
import type { ProjectFlowGraph, ProjectFlowNode } from '../../../editor/core/app/utils/project-flow'
import { createPinia, disposePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isReactive } from 'vue'
import { useFlowStore } from '../../../editor/core/app/stores/flow'

const { projectFlow, clearBuilder } = vi.hoisted(() => ({ projectFlow: vi.fn(), clearBuilder: vi.fn() }))
vi.mock('../../../editor/core/app/utils/project-flow', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../editor/core/app/utils/project-flow')>()
  return {
    ...original,
    createProjectFlowBuilder: () => ({
      buildProjectFlow: projectFlow,
      clear: clearBuilder,
      stats: { sourceHits: 0, sourceMisses: 0, cachedChapters: 0 },
    }),
  }
})

function projection(chapterId: string, length = 3): ProjectFlowGraph {
  const header: ProjectFlowNode = { id: `chapter:${chapterId}`, chapterId, kind: 'chapter', label: chapterId, diagnostics: [], reachability: 'reachable', isEntry: true, conditional: false }
  const story = Array.from({ length }, (_, index): ProjectFlowNode => ({
    ...header,
    id: `story:${chapterId}:node-${index}`,
    kind: 'story',
    runtimeKind: index === 0 ? 'scene' : 'narration',
    address: { chapterId, nodeId: `node-${index}` },
    label: index === 0 ? '开场' : `对白 ${index}`,
    source: { path: `chapters/${chapterId}.adv.md`, line: index + 1, column: 1 },
  }))
  return {
    status: 'ready',
    nodes: [header, ...story],
    edges: [
      { id: `${chapterId}-entry`, source: header.id, target: story[0].id, kind: 'chapter-entry', conditional: false, crossChapter: false },
      ...story.slice(1).map((node, index) => ({ id: `${chapterId}-${index}`, source: story[index].id, target: node.id, kind: 'next' as const, conditional: false, crossChapter: false })),
    ],
    chapters: [{ id: chapterId, title: chapterId, sourcePaths: [`chapters/${chapterId}.adv.md`], nodeIds: story.map(node => node.id), entryNodeId: story[0].id, reachability: 'reachable' }],
    diagnostics: [],
    counts: { chapters: 1, storyNodes: length, choices: 0, reachable: length, unreachable: 0, unknown: 0 },
  }
}
function combine(...graphs: ProjectFlowGraph[]): ProjectFlowGraph {
  return { ...graphs[0], nodes: graphs.flatMap(graph => graph.nodes), edges: graphs.flatMap(graph => graph.edges), chapters: graphs.flatMap(graph => graph.chapters) }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { resolve, reject, promise }
}
let pinia: ReturnType<typeof createPinia>
const model = {} as EditorProjectModel
const measured = (_id: string) => ({ dimensions: { width: 210, height: 150 } }) as GraphNode
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  projectFlow.mockReset()
  clearBuilder.mockReset()
})
afterEach(() => disposePinia(pinia))

describe('project flow lifecycle', () => {
  it('clears a replaced project immediately and ignores its late projection', async () => {
    const old = deferred<ProjectFlowGraph>()
    const next = deferred<ProjectFlowGraph>()
    projectFlow.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise)
    const store = useFlowStore()
    const first = store.loadProject(model, {})
    const second = store.loadProject(model, {})
    expect(store.nodes).toEqual([])
    next.resolve(projection('new'))
    await second
    old.resolve(projection('old'))
    await first
    expect(store.nodes.map(node => node.id)).toEqual(['chapter:new'])
    expect(store.loading).toBe(false)
  })
  it('ignores an older refresh failure and preserves navigation only in the same workspace', async () => {
    const workspace = {}
    const old = deferred<ProjectFlowGraph>()
    projectFlow.mockResolvedValueOnce(projection('current')).mockReturnValueOnce(old.promise).mockResolvedValueOnce(projection('current'))
    const store = useFlowStore()
    await store.loadProject(model, workspace)
    store.selectChapter('current')
    const late = store.loadProject(model, workspace)
    await store.loadProject(model, workspace)
    old.reject(new Error('stale error'))
    await late
    expect(store.error).toBe('')
    expect(store.chapterFilter).toBe('current')
    expect(store.selection.level).toBe('sections')
    projectFlow.mockResolvedValueOnce(projection('other'))
    await store.loadProject(model, {})
    expect(store.chapterFilter).toBe('')
    expect(store.selection.level).toBe('chapters')
  })
  it('removes stale nodes after a current failure or project close', async () => {
    const workspace = {}
    const store = useFlowStore()
    projectFlow.mockResolvedValueOnce(projection('current')).mockRejectedValueOnce(new Error('parse failed'))
    await store.loadProject(model, workspace)
    await store.loadProject(model, workspace)
    expect(store.nodes).toEqual([])
    expect(store.error).toBe('parse failed')
    await store.loadProject(undefined, undefined)
    expect(store.graph).toBeUndefined()
    expect(store.error).toBe('')
    expect(store.loading).toBe(false)
    expect(clearBuilder).toHaveBeenCalled()
  })
})

describe('hierarchical flow presentation and caching', () => {
  it('mounts only chapters initially and expands through sections without deep proxies', async () => {
    projectFlow.mockResolvedValue(combine(projection('a'), projection('b')))
    const store = useFlowStore()
    await store.loadProject(model, {})
    expect(store.visibleNodes.map(node => node.data.kind)).toEqual(['chapter', 'chapter'])
    expect(store.cacheStats.runs).toBe(0)
    expect(isReactive(store.nodes[0])).toBe(false)
    expect(isReactive(store.graph!.nodes)).toBe(false)
    store.expandNode('chapter:a')
    expect(store.selection.level).toBe('sections')
    expect(store.chapterFilter).toBe('a')
    const section = store.nodes.find(node => node.data.kind === 'section')!
    expect(section).toBeDefined()
    store.expandNode(section.data)
    expect(store.selection.level).toBe('details')
    expect(store.visibleNodes.filter(node => !node.data.portal)).toHaveLength(3)
    store.back()
    expect(store.selection.level).toBe('sections')
    store.back()
    expect(store.selection.level).toBe('chapters')
  })
  it('restores each view viewport, direction and positions without running layout again', async () => {
    projectFlow.mockResolvedValue(combine(projection('a'), projection('b')))
    const store = useFlowStore()
    await store.loadProject(model, {})
    store.layoutGraph('TB', measured)
    store.setViewport({ x: 23, y: 42, zoom: 0.7 })
    store.didFit()
    const positions = store.nodes.map(node => ({ ...node.position }))
    store.selectChapter('a')
    store.layoutGraph('LR', measured)
    store.setViewport({ x: 100, y: 12, zoom: 1.2 })
    store.didFit()
    const runs = store.cacheStats.runs
    store.showOverview()
    expect(store.direction).toBe('TB')
    expect(store.viewport).toEqual({ x: 23, y: 42, zoom: 0.7 })
    expect(store.nodes.map(node => node.position)).toEqual(positions)
    expect(store.requiresFit).toBe(false)
    expect(store.layoutGraph('TB', measured)).toEqual({ cacheHit: true, changed: false })
    expect(store.cacheStats.runs).toBe(runs)
    store.selectChapter('a')
    expect(store.viewport).toEqual({ x: 100, y: 12, zoom: 1.2 })
  })
  it('keeps unchanged view caches on refresh and invalidates changed visible content', async () => {
    const workspace = {}
    const original = combine(projection('a'), projection('b'))
    projectFlow.mockResolvedValue(original)
    const store = useFlowStore()
    await store.loadProject(model, workspace)
    store.showDetails('a')
    store.layoutGraph('TB', measured)
    store.setViewport({ x: 50, y: 75, zoom: 1.8 })
    store.didFit()
    const bChanged = combine(projection('a'), { ...projection('b'), nodes: projection('b').nodes.map(node => ({ ...node, label: `changed ${node.label}` })) })
    projectFlow.mockResolvedValue(bChanged)
    await store.loadProject(model, workspace)
    expect(store.requiresFit).toBe(false)
    expect(store.viewport.zoom).toBe(1.8)
    const aChanged = combine({ ...projection('a'), nodes: projection('a').nodes.map(node => ({ ...node, label: `changed ${node.label}` })) }, projection('b'))
    projectFlow.mockResolvedValue(aChanged)
    await store.loadProject(model, workspace)
    expect(store.requiresFit).toBe(true)
    expect(store.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    // Measured dimensions are part of the layout signature; content changes
    // reset view fit even when topology happens to produce identical positions.
    expect(store.layoutGraph('TB', id => ({ ...measured(id), dimensions: { width: 210, height: 190 } }))).toMatchObject({ cacheHit: false })
  })
  it('returns to the original parent page after section and whole-chapter detail navigation', async () => {
    const base = projection('many', 450)
    projectFlow.mockResolvedValue({ ...base, nodes: base.nodes.map(node => node.kind === 'story' ? { ...node, runtimeKind: 'scene' } : node) })
    const store = useFlowStore()
    await store.loadProject(model, {})
    store.selectChapter('many')
    store.setPage(2)
    store.layoutGraph('LR', measured)
    store.setViewport({ x: 20, y: 30, zoom: 0.9 })
    store.didFit()
    store.expandNode(store.nodes[0].data)
    expect(store.selection.level).toBe('details')
    store.back()
    expect(store.selection).toMatchObject({ level: 'sections', page: 2 })
    expect(store.viewport.zoom).toBe(0.9)
    store.showDetails('many')
    expect(store.selection.sectionId).toBeUndefined()
    expect(store.currentView!.totalNodes).toBe(450)
    store.setPage(1)
    store.back()
    expect(store.selection).toMatchObject({ level: 'sections', page: 2 })
    expect(store.viewport.zoom).toBe(0.9)
  })
  it('marks overflow connection summaries as presentation edges and excludes them from layout', async () => {
    const base = projection('dense', 30)
    const story = base.nodes.filter(node => node.kind === 'story').map(node => ({ ...node, runtimeKind: 'scene' }))
    const links = story.flatMap(source => story.map(target => ({ id: `${source.id}-${target.id}`, source: source.id, target: target.id, kind: 'jump' as const, conditional: false, crossChapter: false })))
    projectFlow.mockResolvedValue({ ...base, nodes: [base.nodes[0], ...story], edges: links })
    const store = useFlowStore()
    await store.loadProject(model, {})
    store.selectChapter('dense')
    const summary = store.edges.find(edge => edge.data?.summary)!
    expect(summary).toBeDefined()
    expect(summary.markerEnd).toBeUndefined()
    expect(summary.class).toBe('project-flow-edge-summary')
    store.layoutGraph('LR', measured)
    expect(store.cacheStats.fallbacks).toBe(1)
    expect(store.nodes.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
  })
  it('retains a 10000 node chapter overview when only folded text and route locations change', async () => {
    const workspace = {}
    const large = projection('large', 10000)
    const other = projection('other')
    const route = { id: 'cross-route', source: large.chapters[0].nodeIds.at(-1)!, target: other.chapters[0].nodeIds[0], kind: 'jump' as const, conditional: false, crossChapter: true }
    const initial = { ...combine(large, other), edges: [...large.edges, ...other.edges, route] }
    projectFlow.mockResolvedValue(initial)
    const store = useFlowStore()
    await store.loadProject(model, workspace)
    expect(store.nodes).toHaveLength(2)
    store.layoutGraph('TB', measured)
    store.setViewport({ x: 70, y: 30, zoom: 0.8 })
    store.didFit()
    const changed = {
      ...initial,
      nodes: initial.nodes.map(node => node.kind === 'chapter'
        ? node
        : {
            ...node,
            label: `新的剧情 ${node.label}`,
            source: node.source ? { ...node.source, line: node.source.line + 10 } : undefined,
          }),
    }
    projectFlow.mockResolvedValue(changed)
    await store.loadProject(model, workspace)
    expect(store.nodes).toHaveLength(2)
    expect(store.requiresFit).toBe(false)
    expect(store.viewport).toEqual({ x: 70, y: 30, zoom: 0.8 })
    expect(store.cacheStats.runs).toBe(1)
    // The folded presentation keeps its geometry while source navigation reads
    // the current canonical route, rather than stale cached node data.
    const currentRoute = store.currentView!.edges[0].routes[0]
    expect(currentRoute.source.label).toContain('新的剧情')
    expect(currentRoute.source.source!.line).toBe(10010)
    expect(currentRoute.target.source!.line).toBe(11)
  })
  it('rejects viewport updates captured from a previous view and clears caches on replacement', async () => {
    projectFlow.mockResolvedValue(projection('a'))
    const store = useFlowStore()
    await store.loadProject(model, {})
    store.layoutGraph('TB', measured)
    const oldKey = store.currentView!.key
    store.selectChapter('a')
    store.setViewport({ x: 999, y: 999, zoom: 3 }, oldKey)
    expect(store.viewport.zoom).toBe(1)
    store.showOverview()
    await store.loadProject(model, {})
    expect(store.direction).toBe('LR')
    expect(store.requiresFit).toBe(true)
    expect(store.cacheStats.runs).toBe(0)
  })
  it('layouts only the active projection and reruns only for sizes, direction or explicit force', async () => {
    projectFlow.mockResolvedValue(combine(projection('a'), projection('b'), projection('c')))
    const store = useFlowStore()
    await store.loadProject(model, {})
    store.selectChapter('a')
    store.showDetails('a')
    const findNode = vi.fn(measured)
    store.layoutGraph('TB', findNode)
    expect(findNode.mock.calls.map(([id]) => id)).toEqual(store.visibleNodes.map(node => node.id))
    expect(store.visibleNodes).toHaveLength(3)
    expect(store.layoutGraph('TB', measured).cacheHit).toBe(true)
    expect(store.layoutGraph('LR', measured).cacheHit).toBe(false)
    expect(store.layoutGraph('LR', measured, true).cacheHit).toBe(false)
  })
  it('pages a 2800 node chapter without laying out or mounting the whole runtime graph', async () => {
    projectFlow.mockResolvedValue(projection('large', 2800))
    const store = useFlowStore()
    await store.loadProject(model, {})
    expect(store.graph!.nodes).toHaveLength(2801)
    expect(store.nodes).toHaveLength(1)
    store.showDetails('large')
    expect(store.currentView!.pageCount).toBe(14)
    expect(store.nodes.filter(node => !node.data.portal)).toHaveLength(200)
    expect(store.nodes.length).toBeLessThanOrEqual(220)
    expect(() => store.layoutGraph('LR', measured)).not.toThrow()
    const firstPageIds = new Set(store.nodes.filter(node => !node.data.portal).map(node => node.id))
    store.setPage(13)
    expect(store.currentView!.page).toBe(13)
    expect(store.nodes.filter(node => !node.data.portal).every(node => !firstPageIds.has(node.id))).toBe(true)
    expect(store.nodes.length).toBeLessThanOrEqual(220)
  })
})
