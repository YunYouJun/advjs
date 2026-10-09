// @vitest-environment node

import type { AdvProjectFileMap } from '@advjs/types'
import * as parser from '@advjs/parser'
import { describe, expect, it, vi } from 'vitest'
import { createProjectFlowBuilder, projectFlowStoryId } from '../../../editor/core/app/utils/project-flow'
import { compileProject } from '../../../packages/core/src/project/compile'

async function model(chapters: AdvProjectFileMap, settings: Record<string, unknown> = {}) {
  const files = {
    'adv.config.json': '{"id":"project-flow-cache","root":"adv"}',
    'adv/settings/game.json': JSON.stringify(settings),
    ...chapters,
  }
  return { files, compilation: await compileProject({ files }) }
}

describe('workspace project flow source indexes', () => {
  it('reuses unchanged chapters and reparses only the chapter whose content changed', async () => {
    const files = {
      'adv/chapters/a.adv.md': '## A {#a}\n\n前文。',
      'adv/chapters/b.adv.md': '## B {#b}\n\n后文。',
    }
    const builder = createProjectFlowBuilder()
    const project = await model(files)
    const initial = await builder.buildProjectFlow(project)
    expect(builder.stats).toEqual({ sourceHits: 0, sourceMisses: 2, cachedChapters: 2 })
    expect(await builder.buildProjectFlow(project)).toEqual(initial)
    expect(builder.stats).toEqual({ sourceHits: 2, sourceMisses: 2, cachedChapters: 2 })

    const revised = await model({ ...files, 'adv/chapters/a.adv.md': '## A {#a}\n\n\n新的前文。' })
    const before = JSON.stringify(revised)
    const graph = await builder.buildProjectFlow(revised)
    expect(graph.nodes.find(node => node.label === '新的前文。')!.source).toEqual({ path: 'adv/chapters/a.adv.md', line: 4, column: 1 })
    expect(graph.nodes.find(node => node.label === '后文。')!.source).toBe(initial.nodes.find(node => node.label === '后文。')!.source)
    expect(builder.stats).toEqual({ sourceHits: 3, sourceMisses: 3, cachedChapters: 2 })
    expect(JSON.stringify(revised)).toBe(before)
  })

  it('remaps inserted, removed and reordered sources without retaining prior offsets', async () => {
    const files = {
      'adv/chapters/a.adv.md': '## A {#a}\n\n第一段。\n',
      'adv/chapters/b.adv.md': '## B {#b}\n\n- [回到 A](#a)\n\n留在原地。',
      'adv/chapters/c.adv.md': '## C {#c}\n\n插入段。\n\n另一句。',
    }
    const builder = createProjectFlowBuilder()
    const orders = [
      ['a', 'b'],
      ['c', 'a', 'b'],
      ['b', 'a', 'c'],
      ['b', 'a'],
    ]
    for (const [index, order] of orders.entries()) {
      const project = await model(files, { chapters: [{ id: 'intro', sources: order.map(id => `adv/chapters/${id}.adv.md`) }] })
      const graph = await builder.buildProjectFlow(project)
      expect(graph.status).toBe('ready')
      expect(graph.nodes.find(node => node.label === '第一段。')!.source).toEqual({ path: 'adv/chapters/a.adv.md', line: 3, column: 1 })
      expect(graph.nodes.find(node => node.id === projectFlowStoryId({ chapterId: 'intro', nodeId: 'b' }))!.source).toEqual({ path: 'adv/chapters/b.adv.md', line: 1, column: 1 })
      expect(graph.nodes.find(node => node.kind === 'choice')!.source).toEqual({ path: 'adv/chapters/b.adv.md', line: 3, column: 1 })
      const terminal = graph.nodes.find(node => node.address?.nodeId === 'end')!
      const lastPath = `adv/chapters/${order.at(-1)}.adv.md`
      expect(terminal.source).toEqual({ path: lastPath, line: files[lastPath as keyof typeof files].split('\n').length, column: 1 })
      expect(builder.stats).toEqual({ sourceHits: 0, sourceMisses: index + 1, cachedChapters: 1 })
    }
  })

  it('refreshes diagnostics, topology and reachability while source indexes remain reusable', async () => {
    const project = await model({
      'adv/chapters/a.adv.md': '## A {#a}\n\n对白。',
      'adv/chapters/b.adv.md': '## B {#b}',
    }, { entryChapterId: 'a' })
    const builder = createProjectFlowBuilder()
    const initial = await builder.buildProjectFlow(project)
    expect(initial.chapters.find(chapter => chapter.id === 'b')!.reachability).toBe('unreachable')

    project.compilation.diagnostics.push({ code: 'ADV_SOURCE_REVISED', severity: 'warning', message: 'Current annotation.', path: 'adv/chapters/a.adv.md', line: 3 })
    const program = project.compilation.project.program!
    program.chapters.a.nodes.a.next = { chapterId: 'b', nodeId: 'b' }
    const updated = await builder.buildProjectFlow(project)
    expect(updated.nodes.find(node => node.label === '对白。')!.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_SOURCE_REVISED' }))
    expect(updated.chapters.find(chapter => chapter.id === 'b')!.reachability).toBe('reachable')
    expect(initial.diagnostics).toEqual([])

    project.compilation.diagnostics.length = 0
    program.chapters.a.nodes.a.next = { chapterId: 'missing', nodeId: 'missing' }
    const invalid = await builder.buildProjectFlow(project)
    expect(invalid.status).toBe('invalid')
    expect(invalid.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_EDITOR_FLOW_UNKNOWN_TARGET' }))
    expect(invalid.nodes.find(node => node.label === '对白。')!.diagnostics).toEqual([])
    expect(builder.stats).toEqual({ sourceHits: 4, sourceMisses: 2, cachedChapters: 2 })
  })

  it('exposes authored heading levels without changing runtime node data', async () => {
    const project = await model({ 'adv/chapters/a.adv.md': '# 第一章 {#chapter}\n\n## 第一节 {#section}\n\n### 细节 {#detail}\n\n对白。' })
    const before = JSON.stringify(project.compilation.project.program)
    const graph = await createProjectFlowBuilder().buildProjectFlow(project)
    expect(graph.nodes.filter(node => node.runtimeKind === 'anchor').map(node => node.headingDepth)).toEqual([1, 2, 3])
    expect(graph.nodes.find(node => node.label === '对白。')!.headingDepth).toBeUndefined()
    expect(JSON.stringify(project.compilation.project.program)).toBe(before)
  })

  it('preserves diagnostic order and ranges across normalized multi-file sources', async () => {
    const project = await model({
      'adv/chapters/intro/a.adv.md': '## A {#a}\n\n第一行\n第二行。',
      'adv/chapters/intro/b.adv.md': '## B {#b}',
    })
    project.files['adv\\chapters\\intro\\a.adv.md'] = project.files['adv/chapters/intro/a.adv.md']
    delete project.files['adv/chapters/intro/a.adv.md']
    const annotations = [
      { code: 'B_FIRST', severity: 'warning' as const, message: 'First annotation.', path: 'adv/chapters/intro/b.adv.md', line: 1 },
      { code: 'A_END', severity: 'warning' as const, message: 'End of paragraph.', path: 'adv/chapters/intro/a.adv.md', line: 4 },
      { code: 'A_START', severity: 'warning' as const, message: 'Start of paragraph.', path: 'adv/chapters/intro/a.adv.md', line: 3 },
      { code: 'A_HEADER', severity: 'warning' as const, message: 'Chapter only.', path: 'adv/chapters/intro/a.adv.md' },
    ]
    project.compilation.diagnostics.push(...annotations)
    const graph = await createProjectFlowBuilder().buildProjectFlow(project)
    expect(graph.nodes.find(node => node.kind === 'chapter')!.diagnostics).toEqual(annotations)
    expect(graph.nodes.find(node => node.label === '第一行\n第二行。')!.diagnostics.map(diagnostic => diagnostic.code)).toEqual(['A_END', 'A_START'])
    expect(graph.nodes.find(node => node.label === '第一行\n第二行。')!.source).toEqual({ path: 'adv/chapters/intro/a.adv.md', line: 3, column: 1 })
  })

  it('drops removed chapters and clears all workspace content and counters', async () => {
    const a = { 'adv/chapters/a.adv.md': '## A {#a}' }
    const b = { 'adv/chapters/b.adv.md': '## B {#b}' }
    const builder = createProjectFlowBuilder()
    await builder.buildProjectFlow(await model({ ...a, ...b }))
    await builder.buildProjectFlow(await model(a))
    expect(builder.stats).toEqual({ sourceHits: 1, sourceMisses: 2, cachedChapters: 1 })
    await builder.buildProjectFlow(await model({ ...a, ...b }))
    expect(builder.stats).toEqual({ sourceHits: 2, sourceMisses: 3, cachedChapters: 2 })
    builder.clear()
    expect(builder.stats).toEqual({ sourceHits: 0, sourceMisses: 0, cachedChapters: 0 })
    await builder.buildProjectFlow(await model(a))
    expect(builder.stats).toEqual({ sourceHits: 0, sourceMisses: 1, cachedChapters: 1 })
  })

  it('prevents a late parse from repopulating a cleared or newer workspace cache', async () => {
    const old = await model({ 'adv/chapters/old.adv.md': '旧项目。' })
    const current = await model({ 'adv/chapters/current.adv.md': '新项目。' })
    const parse = parser.parseAst
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    const spy = vi.spyOn(parser, 'parseAst').mockImplementationOnce(async (content) => {
      await pending
      return parse(content)
    })
    const builder = createProjectFlowBuilder()
    try {
      const late = builder.buildProjectFlow(old)
      builder.clear()
      await builder.buildProjectFlow(current)
      release()
      await late
      expect(builder.stats).toEqual({ sourceHits: 0, sourceMisses: 1, cachedChapters: 1 })
      await builder.buildProjectFlow(current)
      expect(builder.stats).toEqual({ sourceHits: 1, sourceMisses: 1, cachedChapters: 1 })
    }
    finally {
      release()
      spy.mockRestore()
    }
  })

  it('keeps large projections iterative and reuses every unchanged chapter index', async () => {
    const files: AdvProjectFileMap = {}
    for (let chapter = 0; chapter < 10; chapter++) {
      files[`adv/chapters/chapter-${chapter}.adv.md`] = Array.from({ length: chapter === 9 ? 277 : 278 }, (_, line) => `第 ${chapter} 章第 ${line} 句。`).join('\n\n')
    }
    const project = await model(files)
    const builder = createProjectFlowBuilder()
    const initial = await builder.buildProjectFlow(project)
    expect(initial.nodes).toHaveLength(2799)
    expect(initial.edges).toHaveLength(2789)
    expect(initial.diagnostics).toEqual([])
    expect(await builder.buildProjectFlow(project)).toEqual(initial)
    expect(builder.stats).toEqual({ sourceHits: 10, sourceMisses: 10, cachedChapters: 10 })
  })
})
