import { describe, expect, it } from 'vitest'
import { parseAst } from '../src'

describe('runtime authoring syntax', () => {
  it('preserves stable anchors on scenes and headings', async () => {
    const ast = await parseAst([
      '【天文台，夜，内景】 {#star-map}',
      '',
      '## 比对结果 {#compare}',
    ].join('\n'))

    expect(ast.children[0]).toMatchObject({
      type: 'scene',
      id: 'star-map',
      place: '天文台',
      time: '夜',
      inOrOut: '内景',
      position: {
        start: { line: 1, column: 1 },
      },
    })
    expect(ast.children[1]).toMatchObject({
      type: 'heading',
      id: 'compare',
      depth: 2,
      value: '比对结果',
      position: {
        start: { line: 3, column: 1 },
      },
    })
  })

  it('preserves exact markdown choice link targets and plain choices', async () => {
    const ast = await parseAst([
      '- 留在当前场景',
      '- [观察星图](#star-map)',
      '- [进入第二章](chapter-2)',
      '- [直接开始比对](chapter-2#compare)',
    ].join('\n'))

    expect(ast.children).toHaveLength(1)
    expect(ast.children[0]).toMatchObject({
      type: 'choices',
      position: {
        start: { line: 1, column: 1 },
      },
      choices: [
        { type: 'choice', text: '留在当前场景' },
        { type: 'choice', text: '观察星图', target: '#star-map' },
        { type: 'choice', text: '进入第二章', target: 'chapter-2' },
        { type: 'choice', text: '直接开始比对', target: 'chapter-2#compare' },
      ],
    })
    expect((ast.children[0] as { choices: Array<{ position?: unknown }> }).choices[1].position).toMatchObject({
      start: { line: 2, column: 1 },
    })
  })

  it('does not consume invalid or unsupported anchors', async () => {
    const ast = await parseAst([
      '【天文台，夜，内景】 {#bad id}',
      '',
      '普通文本 {#text-anchor}',
    ].join('\n'))

    expect(ast.children[0]).toMatchObject({
      type: 'text',
      value: '【天文台，夜，内景】 {#bad id}',
    })
    expect(ast.children[1]).toMatchObject({
      type: 'text',
      value: '普通文本 {#text-anchor}',
    })
  })
})
