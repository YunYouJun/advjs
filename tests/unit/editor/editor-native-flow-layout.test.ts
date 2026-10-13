import type { NativeFlowLayoutNode } from '../../../editor/core/app/utils/native-flow-layout'
import { describe, expect, it } from 'vitest'
import { layoutNativeFlow } from '../../../editor/core/app/utils/native-flow-layout'

function nodes(count: number): NativeFlowLayoutNode[] {
  return Array.from({ length: count }, (_, index) => ({ id: `n${index.toString().padStart(4, '0')}`, width: 240 + index % 3 * 60, height: 100 + index % 5 * 90 }))
}
function chain(input: NativeFlowLayoutNode[]) {
  return input.slice(1).map((node, index) => ({ id: `e${index}`, source: input[index].id, target: node.id }))
}
function expectDisjoint(input: NativeFlowLayoutNode[], positions: Map<string, { x: number, y: number }>) {
  expect(positions.size).toBe(input.length)
  for (const [index, node] of input.entries()) {
    const position = positions.get(node.id)!
    expect(Number.isFinite(position.x) && Number.isFinite(position.y)).toBe(true)
    for (const other of input.slice(index + 1)) {
      const next = positions.get(other.id)!
      expect(position.x + node.width <= next.x || next.x + other.width <= position.x
        || position.y + node.height <= next.y || next.y + other.height <= position.y).toBe(true)
    }
  }
}

describe('native Flow renderer layout', () => {
  it('lays out measured nodes left to right with branch and connector gutters', () => {
    const input = nodes(7)
    const edges = [
      { id: 'ab', source: input[0].id, target: input[1].id },
      { id: 'ac', source: input[0].id, target: input[2].id },
      ...chain(input.slice(2)),
    ]
    const positions = layoutNativeFlow(input, edges, { force: true })
    expectDisjoint(input, positions)
    for (const edge of edges) {
      const source = input.find(node => node.id === edge.source)!
      expect(positions.get(edge.target)!.x - positions.get(edge.source)!.x - source.width).toBeGreaterThanOrEqual(140)
    }
  })

  it('preserves disjoint authored anchors including negative and tightly spaced coordinates', () => {
    const input = nodes(4).map((node, index) => ({ ...node, position: { x: -400 + index * 600, y: -200 } }))
    input[1].position.x = input[0].position.x + input[0].width
    const before = structuredClone(input)
    const positions = layoutNativeFlow(input, chain(input))
    expect(positions).toEqual(new Map(input.map(node => [node.id, node.position])))
    expect(input).toEqual(before)
    expect(positions.get(input[0].id)).not.toBe(input[0].position)
    expect(layoutNativeFlow(input, chain(input), { force: true })).not.toEqual(positions)
  })

  it('repairs mixed missing and duplicate positions predictably, without moving accepted anchors', () => {
    const input = nodes(20).map((node, index) => ({ ...node, position: index % 3 ? { x: 0, y: 0 } : undefined }))
    input[10].position = { x: 1700, y: 600 }
    const before = structuredClone(input)
    const edges = chain(input)
    const positions = layoutNativeFlow(input, edges)
    expectDisjoint(input, positions)
    expect(positions.get(input[1].id)).toEqual({ x: 0, y: 0 })
    expect(positions.get(input[10].id)).toEqual({ x: 1700, y: 600 })
    expect(layoutNativeFlow([...input].reverse(), [...edges].reverse())).toEqual(positions)
    expect(layoutNativeFlow(input.map(node => ({ ...node, position: positions.get(node.id) })), edges)).toEqual(positions)
    expect(input).toEqual(before)
  })

  it('handles cycles, self-links, portals and missing endpoints without phantom nodes', () => {
    const input = [...nodes(8), { id: 'portal:next', width: 310, height: 700 }]
    const edges = [...chain(input), { id: 'back', source: input[7].id, target: input[0].id }, { id: 'self', source: input[0].id, target: input[0].id }, { id: 'missing', source: input[1].id, target: 'absent' }]
    const positions = layoutNativeFlow(input, edges)
    expectDisjoint(input, positions)
    expect(positions.has('absent')).toBe(false)
    expect(layoutNativeFlow(input.map(node => ({ ...node, text: 'edited narrative' })), [...edges].reverse())).toEqual(positions)
  })

  it('uses a bounded size-aware fallback for large cycles and dense graphs', () => {
    const large = nodes(2800)
    const positions = layoutNativeFlow(large, [...chain(large), { id: 'back', source: large.at(-1)!.id, target: large[0].id }])
    expect(positions.size).toBe(2800)
    expect(new Set([...positions.values()].map(position => `${position.x}:${position.y}`)).size).toBe(2800)
    const columns = Math.ceil(Math.sqrt(large.length))
    expect(positions.get(large[columns].id)!.y).toBeGreaterThan(Math.max(...large.slice(0, columns).map(node => node.height)))
    const small = nodes(32)
    const dense = small.flatMap(source => small.map(target => ({ id: `${source.id}-${target.id}`, source: source.id, target: target.id })))
    expectDisjoint(small, layoutNativeFlow(small, dense))
    expect(layoutNativeFlow(small, dense)).toEqual(layoutNativeFlow([...small].reverse(), [...dense].reverse()))
  })

  it('normalizes invalid measurements and overflow-prone coordinates', () => {
    const input = [
      { id: 'a', width: Number.NaN, height: Number.POSITIVE_INFINITY, position: { x: Number.MAX_VALUE, y: 0 } },
      { id: 'b', width: -100, height: 0, position: { x: 0, y: Number.NaN } },
      { id: 'c', width: Number.MAX_VALUE, height: Number.MAX_VALUE },
    ]
    const positions = layoutNativeFlow(input, chain(input))
    expectDisjoint(input.map(node => ({ ...node, width: 280, height: 160 })), positions)
    expect([...positions.values()].every(position => Math.abs(position.x) < 1e9 && Math.abs(position.y) < 1e9)).toBe(true)
    expect(layoutNativeFlow([], [])).toEqual(new Map())
  })
})
