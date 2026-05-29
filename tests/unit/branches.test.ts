import { describe, expect, it } from 'vitest'
import { analyzeBranches, formatJson, formatMermaid, formatText } from '../../packages/advjs/node/commands/branches'

function build(ast: any): any {
  return ast
}

describe('analyzeBranches', () => {
  it('builds a graph for a script with one choices node and two options', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: '学校', time: '白天', inOrOut: '内景' },
        { type: 'dialog', character: { type: 'character', name: 'A' }, children: [] },
        {
          type: 'choices',
          choices: [
            { type: 'choice', text: '同意' },
            { type: 'choice', text: '拒绝', target: '结局A' },
          ],
        },
        { type: 'scene', place: '结局A', time: '夜晚', inOrOut: '内景' },
        { type: 'dialog', character: { type: 'character', name: 'A' }, children: [] },
      ],
      scene: { 学校: 0, 结局A: 3 },
      functions: {},
    })

    const graph = analyzeBranches(ast)
    const ids = new Set(graph.nodes.map(n => n.id))
    expect(ids.has('start')).toBe(true)
    expect(ids.has('end')).toBe(true)
    expect(graph.sceneCount).toBe(2)

    const choicesNode = graph.nodes.find(n => n.kind === 'choices')
    expect(choicesNode).toBeTruthy()
    const optionNodes = graph.nodes.filter(n => n.kind === 'option')
    expect(optionNodes).toHaveLength(2)

    // Option "拒绝" must point at the resolved scene
    const targetEdge = graph.edges.find(e => e.label?.includes('→ 结局A'))
    expect(targetEdge).toBeTruthy()
  })

  it('handles duplicate scene place names without dangling edges (regression)', () => {
    // Two 【学校】 headers — ast.scene collapses them to a single index, but
    // every scene occurrence must still get its own node and every edge must
    // resolve to a real target (no `to: undefined`).
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: '学校', time: '白天', inOrOut: '内景' }, // idx 0
        { type: 'dialog', character: { type: 'character', name: 'A' }, children: [] },
        { type: 'scene', place: '学校', time: '傍晚', inOrOut: '内景' }, // idx 2 — same name
        { type: 'dialog', character: { type: 'character', name: 'A' }, children: [] },
      ],
      // parser keeps only the last occurrence under the place key
      scene: { 学校: 2 },
      functions: {},
    })

    const graph = analyzeBranches(ast)

    // Both scene occurrences become distinct nodes.
    const sceneNodes = graph.nodes.filter(n => n.kind === 'scene')
    expect(sceneNodes).toHaveLength(2)

    // No edge may dangle (every edge has a resolvable `to`).
    const nodeIds = new Set(graph.nodes.map(n => n.id))
    for (const edge of graph.edges) {
      expect(edge.to).toBeTruthy()
      expect(nodeIds.has(edge.to)).toBe(true)
    }

    // start must connect to the first scene.
    expect(graph.edges.some(e => e.from === 'start' && e.to === 'scene_0')).toBe(true)
  })

  it('marks unresolved choice targets as dead when no fall-through exists', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        {
          type: 'choices',
          choices: [
            { type: 'choice', text: '走入虚空', target: 'nowhere' },
          ],
        },
      ],
      scene: {},
      functions: {},
    })

    const graph = analyzeBranches(ast)
    expect(graph.deadOptions).toBe(1)
    expect(graph.nodes.some(n => n.kind === 'dead')).toBe(true)
  })

  it('emits valid mermaid output', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: 'A', time: '', inOrOut: '' },
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
      ],
      scene: { A: 0 },
      functions: {},
    })

    const out = formatMermaid(analyzeBranches(ast))
    expect(out.startsWith('flowchart TD')).toBe(true)
    expect(out).toContain('start')
    expect(out).toContain('end')
  })

  it('json format round-trips through JSON.parse', () => {
    const ast = build({
      type: 'adv-root',
      children: [{ type: 'scene', place: 'A', time: '', inOrOut: '' }],
      scene: { A: 0 },
      functions: {},
    })

    const json = formatJson(analyzeBranches(ast))
    const parsed = JSON.parse(json)
    expect(Array.isArray(parsed.nodes)).toBe(true)
    expect(Array.isArray(parsed.edges)).toBe(true)
  })

  it('text format walks from start', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: 'A', time: '', inOrOut: '' },
        {
          type: 'choices',
          choices: [
            { type: 'choice', text: '继续' },
          ],
        },
      ],
      scene: { A: 0 },
      functions: {},
    })

    const out = formatText(analyzeBranches(ast))
    expect(out).toContain('START')
  })
})
