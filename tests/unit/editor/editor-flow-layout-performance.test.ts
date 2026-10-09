import type { GraphNode, Node } from '@vue-flow/core'
import { describe, expect, it } from 'vitest'
import { useFlowLayout } from '../../../editor/core/app/composables/flow/useFlowLayout'

const nodes = (count: number): Node[] => Array.from({ length: count }, (_, index) => ({ id: `n${index}`, type: 'project-story', position: { x: 0, y: 0 }, data: {} }))
const links = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `e${index}`, source: `n${index}`, target: `n${(index + 1) % count}` }))
const measured = (width: number, height: number) => (_id: string) => ({ dimensions: { width, height } }) as GraphNode

describe('bounded flow layout', () => {
  it('reuses topology, direction and measured sizes but respects explicit auto layout', () => {
    const engine = useFlowLayout()
    const input = nodes(5)
    const edges = links(5)
    const first = engine.layout(input, edges, 'LR', measured(250, 130))
    const second = engine.layout(input.map(node => ({ ...node, data: { text: 'new' } })), [...edges].reverse(), 'LR', measured(250, 130))
    expect(second.map(node => node.position)).toEqual(first.map(node => node.position))
    expect(second[0].data).toEqual({ text: 'new' })
    expect(engine.stats.value).toMatchObject({ runs: 1, hits: 1 })
    engine.layout(input, edges, 'LR', measured(250, 180))
    engine.layout(input, edges, 'TB', measured(250, 180))
    engine.layout(input, edges, 'TB', measured(250, 180), true)
    expect(engine.stats.value.runs).toBe(4)
    engine.clear()
    expect(engine.stats.value.runs).toBe(0)
  })
  it('uses an iterative finite fallback for a 2800 node cycle without overflowing the stack', () => {
    const engine = useFlowLayout()
    const arranged = engine.layout(nodes(2800), links(2800), 'LR', measured(230, 150))
    expect(arranged).toHaveLength(2800)
    expect(arranged.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
    expect(new Set(arranged.map(node => `${node.position.x}:${node.position.y}`)).size).toBe(2800)
    expect(engine.stats.value.fallbacks).toBe(1)
    expect(engine.graph.value.nodeCount()).toBe(0)
    expect(arranged[1].position.y - arranged[0].position.y).toBeGreaterThan(150)
  })
  it('keeps a 201 node linear detail page compact enough to fit boundary actions in both directions', () => {
    const input = nodes(201)
    const edges = input.slice(1).map((node, index) => ({ id: `step-${index}`, source: input[index].id, target: node.id }))
    for (const direction of ['LR', 'TB'] as const) {
      const engine = useFlowLayout()
      const arranged = engine.layout(input, edges, direction, measured(210, 110))
      const width = Math.max(...arranged.map(node => node.position.x + 210))
      const height = Math.max(...arranged.map(node => node.position.y + 110))
      const zoom = Math.min(1000 / (width * 1.25), 600 / (height * 1.25))
      expect(engine.stats.value.fallbacks).toBe(1)
      expect(Math.max(width / height, height / width)).toBeLessThan(2)
      expect(210 * zoom).toBeGreaterThan(40)
      expect(70 * zoom).toBeGreaterThan(12)
      expect(arranged.every(node => Number.isFinite(node.position.x) && Number.isFinite(node.position.y))).toBe(true)
    }
    // A small number of authored branches can still leave an excessively long
    // chain; the post-layout bounds guard compacts that case as well.
    const branch = { id: 'extra-branch', source: 'n0', target: 'n5' }
    const engine = useFlowLayout()
    engine.layout(input, [...edges, branch], 'LR', measured(210, 110))
    expect(engine.stats.value.fallbacks).toBe(1)
  })
  it('uses a bounded fallback for many backward cycles while preserving moderate story revisits', () => {
    const input = nodes(76)
    const forward = input.slice(1).map((node, index) => ({ id: `forward-${index}`, source: input[index].id, target: node.id }))
    const revisits = input.slice(30).map(node => ({ id: `back-${node.id}`, source: node.id, target: 'n0' }))
    const engine = useFlowLayout()
    const arranged = engine.layout(input, [...forward, ...revisits])
    expect(engine.stats.value.fallbacks).toBe(1)
    expect(new Set(arranged.map(node => `${node.position.x}:${node.position.y}`)).size).toBe(76)
    const ordinary = useFlowLayout()
    const branching = input.slice(1).map((node, index) => ({ id: `branch-${index}`, source: input[Math.floor(index / 2)].id, target: node.id }))
    ordinary.layout(input, [...branching, ...revisits.slice(0, 3)])
    expect(ordinary.stats.value.fallbacks).toBe(0)
  })
  it('ignores dangling endpoints and uses fallback for dense bounded graphs', () => {
    const engine = useFlowLayout()
    const input = nodes(10)
    engine.layout(input, [{ id: 'missing', source: 'n0', target: 'missing' }])
    expect(engine.graph.value.hasNode('missing')).toBe(false)
    const dense = nodes(30).flatMap(source => nodes(30).map(target => ({ id: `${source.id}-${target.id}`, source: source.id, target: target.id })))
    const arranged = engine.layout(nodes(30), dense)
    expect(arranged).toHaveLength(30)
    expect(engine.stats.value.fallbacks).toBe(1)
  })
})
