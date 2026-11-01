import type { FlowEditDocument } from './flow-document'
import { flowEditGraph } from './flow-document'

/** Deterministic cycle-safe columns. Layout never changes execution order or source data. */
export function layoutFlowGraph(document: FlowEditDocument, options: { column?: number, row?: number, padding?: number } = {}) {
  const { column = 320, row = 160, padding = 64 } = options
  if (![column, row, padding].every(value => Number.isFinite(value) && value >= 0) || column === 0 || row === 0)
    throw new Error('ADV_FLOW_INVALID_LAYOUT: Expected finite positive spacing and nonnegative padding')
  const graph = flowEditGraph(document)
  const ids = new Set(graph.nodes.map(node => node.id))
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (edge.target.chapterId === document.id && ids.has(edge.target.nodeId))
      outgoing.set(edge.source, [...outgoing.get(edge.source) ?? [], edge.target.nodeId])
  }
  const entry = document.startNodeId ?? graph.nodes[0]?.id
  const ranks = new Map<string, number>(entry && ids.has(entry) ? [[entry, 0]] : [])
  const queue = [...ranks.keys()]
  for (let index = 0; index < queue.length; index++) {
    const source = queue[index]!
    for (const target of outgoing.get(source) ?? []) {
      if (!ranks.has(target)) {
        ranks.set(target, ranks.get(source)! + 1)
        queue.push(target)
      }
    }
  }
  let disconnected = Math.max(0, ...ranks.values()) + 1
  for (const node of graph.nodes) {
    if (!ranks.has(node.id))
      ranks.set(node.id, disconnected++)
  }
  const levels = new Map<number, string[]>()
  for (const node of graph.nodes) {
    const rank = ranks.get(node.id)!
    levels.set(rank, [...levels.get(rank) ?? [], node.id])
  }
  const rows = Math.max(1, ...[...levels.values()].map(level => level.length))
  const positions = Object.fromEntries(graph.nodes.map((node) => {
    const rank = ranks.get(node.id)!
    const level = levels.get(rank)!
    return [node.id, { x: padding + rank * column, y: padding + ((rows - level.length) / 2 + level.indexOf(node.id)) * row }]
  }))
  return { positions, width: Math.max(padding, ...Object.values(positions).map(position => position.x)) + column, height: rows * row + padding * 2 }
}
