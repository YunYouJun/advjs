// @vitest-environment node

import type { ProjectFlowGraph, ProjectFlowNode } from '../../../editor/core/app/utils/project-flow'
import { describe, expect, it } from 'vitest'
import { compileEditorProject } from '../../../editor/core/app/adapters/browser/project'
import starter from '../../../editor/core/app/templates/starter'
import { buildProjectFlow, projectFlowChapterId, projectFlowStoryId } from '../../../editor/core/app/utils/project-flow'
import { buildProjectFlowView, getProjectFlowSections, PROJECT_FLOW_VIEW_EDGE_LIMIT, projectFlowNodeSelection } from '../../../editor/core/app/utils/project-flow-view'

async function starterGraph() {
  const files = Object.fromEntries(starter.files.filter(file => !file.encoding).map(file => [file.name, file.content]))
  return buildProjectFlow(await compileEditorProject({ id: 'hierarchy-starter', files }))
}

async function graphFromFiles(chapters: Record<string, string>) {
  return buildProjectFlow(await compileEditorProject({
    id: 'hierarchy-files',
    files: { 'adv.config.json': '{"id":"hierarchy-files","root":"adv"}', ...chapters },
  }))
}

function expectConnected(view: ReturnType<typeof buildProjectFlowView>) {
  const ids = new Set(view.nodes.map(node => node.id))
  expect(ids.size).toBe(view.nodes.length)
  expect(view.edges.every(edge => ids.has(edge.source) && ids.has(edge.target))).toBe(true)
  expect(view.nodes.length).toBeLessThanOrEqual(240)
  expect(view.edges.length).toBeLessThanOrEqual(PROJECT_FLOW_VIEW_EDGE_LIMIT)
}

function syntheticGraph(length = 550, sections = false, fanout = false): ProjectFlowGraph {
  const chapterId = 'large'
  const story: ProjectFlowNode[] = Array.from({ length }, (_, index) => ({
    id: projectFlowStoryId({ chapterId, nodeId: `n${index}` }),
    kind: 'story',
    label: `剧情 ${index}`,
    chapterId,
    runtimeKind: sections ? 'anchor' : 'text',
    headingDepth: sections ? 2 : undefined,
    address: { chapterId, nodeId: `n${index}` },
    source: { path: 'adv/chapters/large.adv.md', line: index * 2 + 1, column: 1 },
    diagnostics: [],
    reachability: 'reachable',
    isEntry: index === 0,
    conditional: false,
  }))
  const header: ProjectFlowNode = { ...story[0], id: projectFlowChapterId(chapterId), kind: 'chapter', label: '大章', address: undefined }
  return {
    status: 'ready',
    nodes: [header, ...story],
    edges: story.slice(1).map((node, index) => ({ id: `e${index}`, source: fanout ? story[0].id : story[index].id, target: node.id, kind: 'jump', conditional: index % 2 === 0, crossChapter: false })),
    chapters: [{ id: chapterId, title: '大章', sourcePaths: ['adv/chapters/large.adv.md'], nodeIds: story.map(node => node.id), entryNodeId: story[0].id, reachability: 'reachable' }],
    diagnostics: [],
    entryNodeId: story[0].id,
    counts: { chapters: 1, storyNodes: length, choices: 0, reachable: length, unreachable: 0, unknown: 0 },
  }
}

describe('editor hierarchical flow views', () => {
  it('opens the real Starter as three aggregated chapters and retains each cross-chapter destination', async () => {
    const graph = await starterGraph()
    const before = JSON.stringify(graph)
    const view = buildProjectFlowView(graph)
    expect(view.selection).toEqual({ level: 'chapters', page: 0 })
    expect(view.nodes.map(node => node.chapterId)).toEqual(['hello', 'letter', 'ending'])
    expect(view.nodes.every(node => node.kind === 'chapter' && node.aggregate && node.expandTo?.level === 'sections')).toBe(true)
    expect(view.nodes.reduce((count, node) => count + node.aggregate!.storyNodes, 0)).toBe(graph.counts.storyNodes)
    expect(view.nodes.reduce((count, node) => count + node.aggregate!.choices, 0)).toBe(graph.counts.choices)
    expect(view.edges.flatMap(edge => edge.routes.map(route => route.edge)).map(edge => edge.id).sort()).toEqual(graph.edges.filter(edge => edge.crossChapter).map(edge => edge.id).sort())
    expect(new Set(view.edges.map(edge => `${edge.source}->${edge.target}`)).size).toBe(view.edges.length)
    for (const edge of view.edges) {
      for (const route of edge.routes) {
        expect(route.target.address).toBeDefined()
        expect(route.target.source).toBeDefined()
        expect(route.targetSelection.level).toBe('details')
        expect(route.edge.target).toBe(route.target.id)
      }
    }
    expectConnected(view)
    expect(JSON.stringify(graph)).toBe(before)
  })

  it('groups headings and adjacent scenes while keeping each choice with its runtime owner', async () => {
    const graph = await starterGraph()
    const letter = getProjectFlowSections(graph, 'letter')
    expect(letter.map(section => section.label)).toEqual(['午后的演示室', '邮戳上的日期', '信纸上的淡字', '可以回头的地方', '写给明天的自己'])
    const first = letter[0]
    expect(first.nodeIds.map(id => graph.nodes.find(node => node.id === id)!.runtimeKind)).toContain('scene')
    expect(first.source).toEqual(graph.nodes.find(node => node.address?.nodeId === 'window' && node.kind === 'story')!.source)
    for (const choice of graph.nodes.filter(node => node.kind === 'choice')) {
      const owner = projectFlowStoryId(choice.address!)
      expect(getProjectFlowSections(graph).find(section => section.nodeIds.includes(choice.id))?.nodeIds).toContain(owner)
    }
    const view = buildProjectFlowView(graph, { level: 'sections', chapterId: 'letter' })
    expect(view.nodes.filter(node => !node.portal)).toHaveLength(5)
    const endingTitle = graph.chapters.find(chapter => chapter.id === 'ending')!.title
    const endingSections = getProjectFlowSections(graph, 'ending')
    expect(view.nodes.filter(node => node.portal && node.chapterId === 'ending').map(node => node.label).sort()).toEqual(endingSections.map(section => `${endingTitle} · ${section.label}`).sort())
    expect(view.breadcrumbs.map(item => item.label)).toEqual(['章节概览', graph.chapters.find(chapter => chapter.id === 'letter')!.title])
    expectConnected(view)
  })

  it('preserves conditional routes, loops, middle-of-chapter jumps and precise target source lines', async () => {
    const graph = await starterGraph()
    const view = buildProjectFlowView(graph, { level: 'sections', chapterId: 'letter' })
    const reread = graph.nodes.find(node => node.label === '再读一次来信')!
    const conditional = graph.nodes.find(node => node.label === '沿着邮戳理解这封信')!
    const routes = view.edges.flatMap(edge => edge.routes)
    expect(routes.find(route => route.source.id === reread.id)).toMatchObject({ target: { address: { chapterId: 'letter', nodeId: 'window' } } })
    const gated = routes.find(route => route.source.id === conditional.id)!
    expect(gated.edge.conditional).toBe(true)
    expect(gated.target.address?.nodeId).toBe('understand')
    const targetView = buildProjectFlowView(graph, gated.targetSelection)
    expect(targetView.nodes).toContain(graph.nodes.find(node => node.id === gated.target.id))
    expect(gated.target.source?.line).toBeGreaterThan(1)
    expect(view.edges.find(edge => edge.routes.includes(gated))?.conditional).toBe(true)
    expectConnected(targetView)
  })

  it('expands one block only and folds direct external targets without losing their exact addresses', async () => {
    const graph = await starterGraph()
    const understand = graph.nodes.find(node => node.kind === 'story' && node.address?.nodeId === 'understand')!
    const view = buildProjectFlowView(graph, projectFlowNodeSelection(graph, understand.id))
    const section = getProjectFlowSections(graph, 'letter').find(section => section.entryNodeId === understand.id)!
    expect(view.nodes.filter(node => !node.portal).map(node => node.id)).toEqual(section.nodeIds)
    expect(view.nodes.filter(node => node.portal).every(node => node.aggregate && node.expandTo)).toBe(true)
    const ending = view.edges.flatMap(edge => edge.routes).find(route => route.target.address?.nodeId === 'entrusted')!
    expect(ending.target.address).toEqual({ chapterId: 'ending', nodeId: 'entrusted' })
    const destination = view.nodes.find(node => node.id === view.edges.find(edge => edge.routes.includes(ending))!.target)!
    expect(destination.portal).toBe(true)
    expect(destination.source).toEqual(ending.target.source)
    expect(buildProjectFlowView(graph, destination.expandTo!).nodes).toContain(ending.target)
    expect(view.breadcrumbs).toHaveLength(3)
    expectConnected(view)
  })

  it('shows the whole selected chapter when details has no section id and keeps section drills separate', async () => {
    const graph = await starterGraph()
    const chapter = graph.chapters.find(chapter => chapter.id === 'letter')!
    const whole = buildProjectFlowView(graph, { level: 'details', chapterId: 'letter' })
    expect(whole.selection.sectionId).toBeUndefined()
    expect(whole.nodes.filter(node => !node.portal).map(node => node.id)).toEqual(chapter.nodeIds)
    expect(whole.totalNodes).toBe(chapter.nodeIds.length)
    expect(whole.breadcrumbs.at(-1)?.label).toBe('剧情详情')
    const block = buildProjectFlowView(graph, { level: 'details', chapterId: 'letter', sectionId: getProjectFlowSections(graph, 'letter')[2].id })
    expect(block.totalNodes).toBeLessThan(whole.totalNodes)
    expect(buildProjectFlowView(graph, { level: 'details', chapterId: 'letter', sectionId: 'deleted' }).selection.level).toBe('sections')
    expectConnected(whole)
  })

  it('handles prefix text, multiple files, lower-level headings and untitled fallback blocks', async () => {
    const graph = await graphFromFiles({
      'adv/chapters/multi/01.adv.md': '前言。\n\n## 主要段落 {#main}\n\n### 小节 {#sub}\n\n正文。',
      'adv/chapters/multi/02.adv.md': '另一文件的无标题文本。\n\n第二段。',
      'adv/chapters/multi/03.adv.md': '新文件前言。\n\n## 尾声 {#finish}\n\n结束。',
    })
    expect(graph.status).toBe('ready')
    const sections = getProjectFlowSections(graph, 'multi')
    expect(sections.map(section => section.label)).toEqual(['01', '主要段落', '02', '03', '尾声'])
    const subheading = graph.nodes.find(node => node.address?.nodeId === 'sub')!
    expect(subheading.headingDepth).toBe(3)
    expect(sections.find(section => section.nodeIds.includes(subheading.id))?.label).toBe('主要段落')
    expect(sections.flatMap(section => section.nodeIds)).toEqual(graph.chapters[0].nodeIds)
    expectConnected(buildProjectFlowView(graph, { level: 'sections', chapterId: 'multi' }))
  })

  it('keeps invalid chapter diagnostics navigable and tolerates empty or stale selections', async () => {
    const invalid = await graphFromFiles({ 'adv/chapters/intro.adv.md': '- [未知](missing#where)' })
    expect(invalid.status).toBe('invalid')
    const view = buildProjectFlowView(invalid, { level: 'sections', chapterId: 'intro' })
    expect(view.nodes).toHaveLength(1)
    expect(view.nodes[0].source).toMatchObject({ path: 'adv/chapters/intro.adv.md', line: 1 })
    expect(view.nodes[0].diagnostics).not.toEqual([])
    expect(view.edges).toEqual([])
    expect(buildProjectFlowView(invalid, { level: 'details', chapterId: 'deleted', sectionId: 'stale' }).selection.level).toBe('chapters')
    const empty: ProjectFlowGraph = { ...invalid, status: 'empty', chapters: [], nodes: [], edges: [], diagnostics: [] }
    expect(buildProjectFlowView(empty).nodes).toEqual([])
    expect(buildProjectFlowView(empty).pageCount).toBe(1)
    expectConnected(view)
  })

  it('paginates huge single blocks and provides accurate next-page portals without dangling edges', () => {
    const graph = syntheticGraph()
    const firstSelection = projectFlowNodeSelection(graph, graph.chapters[0].nodeIds[0])
    const first = buildProjectFlowView(graph, firstSelection)
    expect(first.totalNodes).toBe(550)
    expect(first.pageCount).toBe(3)
    expect(first.nodes.filter(node => !node.portal)).toHaveLength(200)
    const next = first.nodes.find(node => node.portal && node.expandTo?.page === 1)!
    expect(next).toBeDefined()
    const second = buildProjectFlowView(graph, next.expandTo!)
    expect(second.page).toBe(1)
    expect(second.nodes.filter(node => !node.portal)[0].address?.nodeId).toBe('n200')
    const last = buildProjectFlowView(graph, { ...firstSelection, page: 99 })
    expect(last.page).toBe(2)
    expect(last.nodes.filter(node => !node.portal)).toHaveLength(150)
    expect(buildProjectFlowView(graph, { ...firstSelection, page: -4 }).page).toBe(0)
    for (const view of [first, second, last])
      expectConnected(view)
  })

  it('bounds thousands of fan-out destinations and keeps every overflow route individually expandable', () => {
    const graph = syntheticGraph(2500, true, true)
    const selection = projectFlowNodeSelection(graph, graph.chapters[0].nodeIds[0])
    const view = buildProjectFlowView(graph, selection)
    const overflow = view.nodes.find(node => node.overflow)!
    expect(overflow).toBeDefined()
    expect(overflow.expandTo).toBeUndefined()
    expect(view.nodes.filter(node => node.portal).length).toBeLessThanOrEqual(40)
    const overflowRoutes = view.edges.filter(edge => edge.source === overflow.id || edge.target === overflow.id).flatMap(edge => edge.routes)
    expect(overflowRoutes.length).toBeGreaterThan(2400)
    expect(view.edges.flatMap(edge => edge.routes.map(route => route.edge)).map(edge => edge.id).sort()).toEqual(graph.edges.map(edge => edge.id).sort())
    const lastRoute = overflowRoutes.find(route => route.target.address?.nodeId === 'n2499')!
    expect(buildProjectFlowView(graph, lastRoute.targetSelection).nodes).toContain(lastRoute.target)
    expectConnected(view)
    expectConnected(buildProjectFlowView(graph, { level: 'sections', chapterId: 'large' }))
  })

  it('paginates full detail mode and reuses indexed views without retaining unbounded navigation history', () => {
    const graph = syntheticGraph(5500)
    const selection = projectFlowNodeSelection(graph, graph.chapters[0].nodeIds[0])
    const first = buildProjectFlowView(graph, selection)
    expect(buildProjectFlowView(graph, { ...selection, page: -10 })).toBe(first)
    expect(getProjectFlowSections(graph)).toBe(getProjectFlowSections(graph))
    const all = buildProjectFlowView(graph, { level: 'all', page: 1 })
    expect(all.totalNodes).toBe(5501)
    expect(all.nodes.filter(node => !node.portal)).toHaveLength(200)
    expectConnected(all)
    for (let page = 1; page < 28; page++)
      buildProjectFlowView(graph, { ...selection, page })
    expect(buildProjectFlowView(graph, selection)).not.toBe(first)
  })

  it('returns through breadcrumbs to the parent page containing the expanded section or chapter', () => {
    const graph = syntheticGraph(550, true)
    const view = buildProjectFlowView(graph, projectFlowNodeSelection(graph, graph.chapters[0].nodeIds[449]))
    const parent = view.breadcrumbs.at(-2)!.selection
    expect(parent).toEqual({ level: 'sections', chapterId: 'large', page: 2 })
    expect(buildProjectFlowView(graph, parent).nodes).toContainEqual(expect.objectContaining({ id: view.selection.sectionId }))

    const chapterGraph: ProjectFlowGraph = {
      ...graph,
      nodes: Array.from({ length: 450 }, (_, ordinal) => ({ ...graph.nodes[0], id: projectFlowChapterId(`c${ordinal}`), chapterId: `c${ordinal}` })),
      edges: [],
      chapters: Array.from({ length: 450 }, (_, ordinal) => ({ ...graph.chapters[0], id: `c${ordinal}`, nodeIds: [], entryNodeId: undefined })),
    }
    const chapter = buildProjectFlowView(chapterGraph, { level: 'sections', chapterId: 'c449' })
    expect(chapter.breadcrumbs[0].selection).toEqual({ level: 'chapters', page: 2 })
    expect(buildProjectFlowView(chapterGraph, chapter.breadcrumbs[0].selection).nodes).toContainEqual(expect.objectContaining({ chapterId: 'c449' }))
  })

  it('bounds real densely connected blocks while keeping every omitted transition inspectable', async () => {
    const count = 40
    const content = Array.from({ length: count }, (_, source) => [
      `## 场景 ${source} {#s${source}}`,
      Array.from({ length: count }, (_, target) => `- [进入 ${target}](#s${target})`).join('\n'),
    ].join('\n\n')).join('\n\n')
    const graph = await graphFromFiles({ 'adv/chapters/dense.adv.md': content })
    expect(graph.status).toBe('ready')
    const before = JSON.stringify(graph)
    const view = buildProjectFlowView(graph, { level: 'sections', chapterId: 'dense' })
    const summary = view.nodes.find(node => node.overflowKind === 'connections')!
    const summaryEdge = view.edges.find(edge => edge.summary)!
    expect(summary).toBeDefined()
    expect(summary).toMatchObject({ overflow: true, source: undefined, address: undefined })
    expect(summary.expandTo).toBeUndefined()
    expect(summaryEdge.source).toBe(summary.id)
    expect(summaryEdge.target).toBe(summary.id)
    expect(view.edges).toHaveLength(600)
    expect(view.edges.flatMap(edge => edge.routes.map(route => route.edge)).map(edge => edge.id).sort()).toEqual(graph.edges.filter(edge => edge.kind === 'jump').map(edge => edge.id).sort())
    expect(summaryEdge.routes.length).toBeGreaterThan(1000)
    for (const route of [summaryEdge.routes[0], summaryEdge.routes.at(-1)!])
      expect(buildProjectFlowView(graph, route.targetSelection).nodes).toContain(route.target)
    expectConnected(view)
    expect(JSON.stringify(graph)).toBe(before)
  })
})
