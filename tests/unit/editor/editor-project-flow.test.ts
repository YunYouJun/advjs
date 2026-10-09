// @vitest-environment node

import type { AdvProjectFileMap } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { buildProjectFlow, projectFlowStoryId } from '../../../editor/core/app/utils/project-flow'
import { compileProject } from '../../../packages/core/src/project/compile'

async function model(chapters: AdvProjectFileMap, settings: Record<string, unknown> = {}) {
  const files = {
    'adv.config.json': '{"id":"project-flow","root":"adv"}',
    'adv/settings/game.json': JSON.stringify(settings),
    ...chapters,
  }
  return { files, compilation: await compileProject({ files }) }
}

describe('editor project flow projection', () => {
  it('uses project chapters and linked choices with precise positions across source files', async () => {
    const project = await model({
      'adv/chapters/intro/01.adv.md': '## 开始 {#start}\n\n前文。',
      'adv/chapters/intro/02.adv.md': '- [下一章](ending#finish)\n- [留在这里](#start)',
      'adv/chapters/ending.adv.md': '## 终章 {#finish}\n\n抵达终章。',
      'adv/chapters/unused.adv.md': '## 开始 {#start}\n\n另一个分支。',
    }, { entryChapterId: 'intro' })
    const before = JSON.stringify(project)
    const graph = await buildProjectFlow(project)

    expect(graph.status).toBe('ready')
    expect(graph.entryNodeId).toBe(projectFlowStoryId({ chapterId: 'intro', nodeId: 'start' }))
    expect(graph.nodes.find(node => node.label === '前文。')).toMatchObject({
      source: { path: 'adv/chapters/intro/01.adv.md', line: 3, column: 1 },
      reachability: 'reachable',
    })
    const nextChapter = graph.nodes.find(node => node.kind === 'choice' && node.label === '下一章')!
    expect(nextChapter.source).toEqual({ path: 'adv/chapters/intro/02.adv.md', line: 1, column: 1 })
    expect(graph.nodes.find(node => node.label === '留在这里')!.source).toEqual({ path: 'adv/chapters/intro/02.adv.md', line: 2, column: 1 })
    expect(graph.edges).toContainEqual(expect.objectContaining({
      source: nextChapter.id,
      target: projectFlowStoryId({ chapterId: 'ending', nodeId: 'finish' }),
      kind: 'jump',
      crossChapter: true,
    }))
    expect(graph.chapters.find(chapter => chapter.id === 'unused')!.reachability).toBe('unreachable')
    expect(graph.chapters.find(chapter => chapter.id === 'intro')!.sourcePaths).toEqual([
      'adv/chapters/intro/01.adv.md',
      'adv/chapters/intro/02.adv.md',
    ])
    expect(new Set(graph.nodes.map(node => node.id)).size).toBe(graph.nodes.length)
    expect(graph.edges.every(edge => graph.nodes.some(node => node.id === edge.target))).toBe(true)
    expect(graph.counts).toMatchObject({ chapters: 3, choices: 2, unknown: 0 })
    expect(JSON.stringify(project)).toBe(before)
  })

  it('follows the configured current entry and preserves stable authored ids across reordering', async () => {
    const project = await model({
      'adv/chapters/a.adv.md': '## A {#same}',
      'adv/chapters/b.adv.md': '## B {#same}\n\n- [回到 A](a#same)\n\n  ```yaml\n  id: return-to-a\n  ```',
    }, { entryChapterId: 'b' })
    const first = await buildProjectFlow(project)
    project.compilation.project.chapters.reverse()
    const reordered = await buildProjectFlow(project)
    expect(first.entryNodeId).toBe(projectFlowStoryId({ chapterId: 'b', nodeId: 'same' }))
    expect(first.nodes.find(node => node.kind === 'choice')!.id).toContain('return-to-a')
    expect(first.nodes.map(node => node.id).sort()).toEqual(reordered.nodes.map(node => node.id).sort())
    expect(first.nodes.filter(node => node.kind === 'story' && node.isEntry)).toHaveLength(1)
    expect(first.chapters.every(chapter => chapter.reachability === 'reachable')).toBe(true)
  })

  it('retains chapters and diagnostic navigation when a jump fails compilation', async () => {
    const project = await model({ 'adv/chapters/intro.adv.md': '## 开始 {#start}\n\n- [走向未知](missing#finish)' })
    expect(project.compilation.project.program).toBeUndefined()
    const graph = await buildProjectFlow(project)
    expect(graph.status).toBe('invalid')
    expect(graph.entryNodeId).toBeUndefined()
    expect(graph.edges).toEqual([])
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0]).toMatchObject({ kind: 'chapter', reachability: 'unknown', isEntry: true })
    expect(graph.nodes[0].diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_UNKNOWN_TARGET',
      path: 'adv/chapters/intro.adv.md',
      line: 3,
    }))
    expect(graph.counts).toMatchObject({ chapters: 1, storyNodes: 0, choices: 0, reachable: 0, unreachable: 0 })
  })

  it('does not connect an explicit ending to the later branch or invent a path out of a cycle', async () => {
    const ended = await model({
      'adv/chapters/intro.adv.md': '开始。\n\n```yaml\ntype: end\ntext: 完结\n```\n\n## 之后 {#later}\n\n这段无法到达。',
    })
    const graph = await buildProjectFlow(ended)
    const ending = graph.nodes.find(node => node.label === '完结')!
    expect(graph.edges.some(edge => edge.source === ending.id)).toBe(false)
    expect(graph.nodes.find(node => node.label === '这段无法到达。')!.reachability).toBe('unreachable')

    const loop = await buildProjectFlow(await model({
      'adv/chapters/intro.adv.md': '## 循环 {#loop}\n\n- [重来](#loop)',
    }))
    expect(loop.status).toBe('ready')
    expect(loop.nodes.find(node => node.label === '重来')!.reachability).toBe('reachable')
    expect(loop.nodes.some(node => node.address?.nodeId === 'end')).toBe(false)
  })

  it('omits unused Markdown compiler terminals after explicit endings and preserves real endings', async () => {
    const project = await model({
      'adv/chapters/intro.adv.md': '开场。\n\n```yaml\ntype: end\n```',
    })
    expect(project.compilation.project.program!.chapters.intro.nodes.end.kind).toBe('end')
    const graph = await buildProjectFlow(project)
    expect(graph.nodes.some(node => node.address?.nodeId === 'end')).toBe(false)
    expect(graph.nodes.find(node => node.runtimeKind === 'end')).toMatchObject({ label: '结束', reachability: 'reachable' })
    expect(graph.counts.unreachable).toBe(0)
    expect(graph.diagnostics).toEqual([])

    const natural = await buildProjectFlow(await model({ 'adv/chapters/intro.adv.md': '自然结束。' }))
    expect(natural.nodes.find(node => node.address?.nodeId === 'end')).toMatchObject({ label: '结束', reachability: 'reachable' })

    project.compilation.project.format = 'flow'
    const authoredFlow = await buildProjectFlow(project)
    expect(authoredFlow.nodes.some(node => node.address?.nodeId === 'end')).toBe(true)
  })

  it('retains an automatic terminal when a conditional ending can fall through', async () => {
    const project = await model({
      'adv/chapters/intro.adv.md': '```yaml\ntype: when\ncondition: shouldEnd\n```\n\n```yaml\ntype: end\n```',
    })
    const graph = await buildProjectFlow(project)
    const terminal = graph.nodes.find(node => node.address?.nodeId === 'end')!
    expect(terminal).toMatchObject({ label: '结束', reachability: 'reachable' })
    expect(graph.edges).toContainEqual(expect.objectContaining({ target: terminal.id, conditional: true }))
  })

  it('uses readable declarative operation and action content instead of generated node ids', async () => {
    const graph = await buildProjectFlow(await model({
      'adv/chapters/intro.adv.md': [
        '```yaml',
        'type: background',
        'name: library',
        '```',
        '',
        '```yaml',
        'type: actions',
        'actions:',
        '  - type: variables/set',
        '    key: visited',
        '    value: true',
        '```',
        '',
        '```yaml',
        'type: activity',
        'use: plugin/activity',
        '```',
      ].join('\n'),
    }))
    expect(graph.nodes.find(node => node.runtimeKind === 'effects')!.label).toBe('背景 · library')
    expect(graph.nodes.find(node => node.runtimeKind === 'actions')!.label).toBe('variables/set · visited')
    expect(graph.nodes.find(node => node.runtimeKind === 'plugin/activity')!.label).toMatch(/^plugin\/activity · node-/)
  })

  it('shows conditional routes without treating initial variable values as permanent or running actions', async () => {
    const project = await model({
      'adv/chapters/intro.adv.md': [
        '- [可能分支](ending#finish)',
        '',
        '  ```yaml',
        '  when: allowEnding',
        '  actions:',
        '    - type: variables/set',
        '      key: executed',
        '      value: true',
        '  ```',
        '',
        '- [禁用分支](unused#finish)',
        '',
        '  ```yaml',
        '  when: "false"',
        '  ```',
      ].join('\n'),
      'adv/chapters/ending.adv.md': '## 终章 {#finish}',
      'adv/chapters/unused.adv.md': '## 未用 {#finish}',
    }, { entryChapterId: 'intro', variables: { allowEnding: false } })
    const graph = await buildProjectFlow(project)
    expect(graph.nodes.find(node => node.label === '可能分支')).toMatchObject({ conditional: true, reachability: 'reachable' })
    expect(graph.nodes.find(node => node.label === '禁用分支')).toMatchObject({ conditional: true, reachability: 'unreachable' })
    expect(graph.chapters.find(chapter => chapter.id === 'ending')!.reachability).toBe('reachable')
    expect(graph.chapters.find(chapter => chapter.id === 'unused')!.reachability).toBe('unreachable')
    expect(graph.edges.some(edge => edge.kind === 'fallback')).toBe(true)
    expect(project.compilation.project.game.variables).toEqual({ allowEnding: false })
  })

  it('marks unknown navigation conservatively for a reachable plugin without invoking it', async () => {
    const project = await model({
      'adv/chapters/intro.adv.md': '```yaml\ntype: activity\nuse: plugin/activity\n```',
      'adv/chapters/unused.adv.md': '隐含的插件目标。',
    }, { entryChapterId: 'intro' })
    const graph = await buildProjectFlow(project)
    expect(graph.status).toBe('ready')
    expect(graph.nodes.find(node => node.runtimeKind === 'plugin/activity')!.reachability).toBe('reachable')
    expect(graph.chapters.find(chapter => chapter.id === 'unused')!.reachability).toBe('unknown')
    expect(graph.counts.unknown).toBeGreaterThan(0)
    expect(graph.counts.unreachable).toBe(0)
  })

  it('rejects missing targets defensively and keeps successful diagnostic source annotations', async () => {
    const project = await model({ 'adv/chapters/intro.adv.md': '## 开始 {#start}\n\n对白。' })
    project.compilation.diagnostics.push({ code: 'ADV_TEST_WARNING', severity: 'warning', message: 'Inspect this text.', path: 'adv/chapters/intro.adv.md', line: 3, column: 1 })
    const node = project.compilation.project.program!.chapters.intro.nodes.start
    node.next = { chapterId: 'ghost', nodeId: 'missing' }
    const graph = await buildProjectFlow(project)
    expect(graph.status).toBe('invalid')
    expect(graph.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_EDITOR_FLOW_UNKNOWN_TARGET' }))
    expect(graph.nodes.find(node => node.label === '对白。')!.diagnostics).toContainEqual(expect.objectContaining({ code: 'ADV_TEST_WARNING' }))
    expect(graph.edges.every(edge => graph.nodes.some(node => node.id === edge.target))).toBe(true)
    expect(graph.chapters).toHaveLength(1)
  })
})
