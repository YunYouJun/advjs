import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram } from '../../src/compiler'

const chapter = `---
title: Runtime Demo
---

\`\`\`yaml
type: background
url: observatory.webp
\`\`\`

@我(smile)
星图已经展开。

- 继续观察
- 返回舱室
`

describe('compileMarkdownProgram', () => {
  it('normalizes narrative, choices, and code operations', async () => {
    const result = await compileMarkdownProgram({
      id: 'demo',
      chapters: [{ id: 'chapter-1', title: '第一章', content: chapter }],
    })

    expect(result.diagnostics).toEqual([])
    const runtimeChapter = result.program?.chapters['chapter-1']
    expect(runtimeChapter?.order.map(id => runtimeChapter.nodes[id].kind)).toEqual([
      'effects',
      'dialog',
      'choices',
      'end',
    ])
    expect(runtimeChapter?.nodes['node-0'].next).toEqual({
      chapterId: 'chapter-1',
      nodeId: 'node-1',
    })
  })

  it('rejects executable script blocks instead of compiling code strings', async () => {
    const result = await compileMarkdownProgram({
      id: 'unsafe',
      chapters: [{
        id: 'chapter-1',
        content: `\`\`\`js\nwindow.alert('unsafe')\n\`\`\``,
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_EXECUTABLE_SCRIPT')
  })

  it('rejects executable choice actions before they reach the runtime', async () => {
    const result = await compileMarkdownProgram({
      id: 'unsafe-choice',
      chapters: [{
        id: 'chapter-1',
        content: `- Run\n\n  \`\`\`js\n  window.alert('unsafe')\n  \`\`\``,
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_EXECUTABLE_CHOICE_ACTION')
  })

  it('links local, chapter-entry, and cross-chapter choice targets exactly', async () => {
    const result = await compileMarkdownProgram({
      id: 'navigation',
      chapters: [
        {
          id: 'chapter-1',
          sourcePath: 'chapters/one.adv.md',
          content: [
            '【天文台，夜，内景】 {#star-map}',
            '',
            '- 留在当前场景',
            '- [观察星图](#star-map)',
            '- [进入第二章](chapter-2)',
            '- [直接开始比对](chapter-2#compare)',
          ].join('\n'),
        },
        {
          id: 'chapter-2',
          sourcePath: 'chapters/two.adv.md',
          content: [
            '# 第二章 {#arrival}',
            '',
            '抵达观测站。',
            '',
            '## 比对结果 {#compare}',
            '',
            '星图完全重合。',
          ].join('\n'),
        },
      ],
    })

    expect(result.diagnostics).toEqual([])
    const chapter = result.program?.chapters['chapter-1']
    expect(chapter?.entry).toBe('star-map')
    expect(chapter?.nodes['star-map']).toMatchObject({ id: 'star-map', kind: 'scene' })
    expect(chapter?.nodes['node-1'].data?.options).toEqual([
      { id: 'choice-1', label: '留在当前场景' },
      { id: 'choice-2', label: '观察星图', target: { chapterId: 'chapter-1', nodeId: 'star-map' } },
      { id: 'choice-3', label: '进入第二章', target: { chapterId: 'chapter-2', nodeId: 'arrival' } },
      { id: 'choice-4', label: '直接开始比对', target: { chapterId: 'chapter-2', nodeId: 'compare' } },
    ])
    expect(result.program?.chapters['chapter-2'].nodes.compare).toMatchObject({
      id: 'compare',
      kind: 'anchor',
    })
  })

  it('reports duplicate stable ids at the duplicate source position', async () => {
    const result = await compileMarkdownProgram({
      id: 'duplicates',
      chapters: [{
        id: 'chapter-1',
        sourcePath: 'chapters/duplicate.adv.md',
        content: [
          '## First {#same}',
          '',
          '## Second {#same}',
        ].join('\n'),
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_RUNTIME_DUPLICATE_NODE',
      source: {
        file: 'chapters/duplicate.adv.md',
        line: 3,
        column: 1,
      },
    }))
  })

  it.each([
    ['missing chapter', 'missing#start', 'ADV_RUNTIME_UNKNOWN_TARGET'],
    ['missing node', '#missing', 'ADV_RUNTIME_UNKNOWN_TARGET'],
    ['empty fragment', 'chapter-2#', 'ADV_RUNTIME_INVALID_TARGET'],
    ['multiple fragments', 'chapter-2#one#two', 'ADV_RUNTIME_INVALID_TARGET'],
  ])('reports %s choice targets with source context', async (_name, target, code) => {
    const result = await compileMarkdownProgram({
      id: 'broken-navigation',
      chapters: [
        {
          id: 'chapter-1',
          sourcePath: 'chapters/broken.adv.md',
          content: `- [Go](${target})`,
        },
        {
          id: 'chapter-2',
          content: '# Second {#start}',
        },
      ],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code,
      source: {
        file: 'chapters/broken.adv.md',
        line: 1,
        column: 1,
      },
    }))
  })
})
