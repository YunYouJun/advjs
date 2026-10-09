import type { Edge, GraphNode, Node } from '@vue-flow/core'
import dagre from '@dagrejs/dagre'
import { Position } from '@vue-flow/core'
import { shallowRef } from 'vue'

export type FindFlowNode = (id: string) => GraphNode | undefined
export type FlowLayoutDirection = 'LR' | 'TB'

interface NodeSize { width: number, height: number }
interface CachedLayout {
  positions: Map<string, { x: number, y: number }>
  method: 'dagre' | 'grid'
}

const MAX_DAGRE_NODES = 240
const MAX_CACHED_LAYOUTS = 48

function nodeSize(node: Node, findNode?: FindFlowNode): NodeSize {
  const measured = findNode?.(node.id)?.dimensions
  return {
    width: measured?.width && Number.isFinite(measured.width) && measured.width > 0 ? measured.width : (node.type === 'project-story' ? 210 : 150),
    height: measured?.height && Number.isFinite(measured.height) && measured.height > 0 ? measured.height : (node.type === 'project-story' ? 110 : 50),
  }
}

/** A bounded, iterative fallback for imported graphs and very dense routes. */
function gridPositions(nodes: Node[], sizes: Map<string, NodeSize>, direction: FlowLayoutDirection) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  let maxWidth = 1
  let maxHeight = 1
  for (const size of sizes.values()) {
    maxWidth = Math.max(maxWidth, size.width)
    maxHeight = Math.max(maxHeight, size.height)
  }
  return new Map(nodes.map((node, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    return [node.id, direction === 'LR'
      ? { x: 12 + row * (maxWidth + 56), y: 12 + column * (maxHeight + 24) }
      : { x: 12 + column * (maxWidth + 24), y: 12 + row * (maxHeight + 56) }]
  }))
}

/** Layout only mounted views; reuse topology, direction and measured-size matches. */
export function useFlowLayout() {
  const graph = shallowRef(new dagre.graphlib.Graph())
  const cache = new Map<string, CachedLayout>()
  const stats = shallowRef({ runs: 0, hits: 0, fallbacks: 0 })

  function clear() {
    cache.clear()
    graph.value = new dagre.graphlib.Graph()
    stats.value = { runs: 0, hits: 0, fallbacks: 0 }
  }

  function layout(nodes: Node[], edges: Edge[], direction: FlowLayoutDirection = 'LR', findNode?: FindFlowNode, force = false) {
    const sizes = new Map(nodes.map(node => [node.id, nodeSize(node, findNode)]))
    const ids = new Set(sizes.keys())
    const ordinals = new Map(nodes.map((node, index) => [node.id, index]))
    // Dagre silently creates phantom endpoints for dangling edges. A view owns
    // only its visible nodes, including the explicit portals supplied by projection.
    const links = [...new Set(edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)).map(edge => JSON.stringify([edge.source, edge.target])))].sort().map(link => JSON.parse(link) as [string, string])
    // Many authored backward routes make Dagre's cycle breaking and ranking
    // expensive even for a bounded view. A few revisits retain story layout.
    let backwardLinks = 0
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    for (const [source, target] of links) {
      backwardLinks += Number(ordinals.get(source)! >= ordinals.get(target)!)
      outDegree.set(source, (outDegree.get(source) ?? 0) + 1)
      inDegree.set(target, (inDegree.get(target) ?? 0) + 1)
    }
    // A long line fits into a sub-pixel strip. Compact paging is useful only
    // when its whole page also keeps nodes and boundary actions visible.
    const longLinearPath = nodes.length > 40 && nodes.every(node => (inDegree.get(node.id) ?? 0) <= 1 && (outDegree.get(node.id) ?? 0) <= 1)
    const key = JSON.stringify([direction, nodes.map(node => [node.id, sizes.get(node.id)]), links])
    let entry = !force ? cache.get(key) : undefined
    if (entry) {
      cache.delete(key)
      cache.set(key, entry)
      stats.value = { ...stats.value, hits: stats.value.hits + 1 }
    }
    else {
      const dagreGraph = new dagre.graphlib.Graph()
      graph.value = dagreGraph
      dagreGraph.setDefaultEdgeLabel(() => ({}))
      dagreGraph.setGraph({ rankdir: direction, ranksep: 56, nodesep: 24, marginx: 12, marginy: 12 })
      let method: CachedLayout['method'] = 'dagre'
      let positions: CachedLayout['positions']
      // Recursive Dagre passes can overflow for long cycles. Paging bounds the
      // normal UI; this fallback also handles externally supplied large graphs.
      if (longLinearPath || nodes.length > MAX_DAGRE_NODES || links.length > Math.max(120, nodes.length * 3) || backwardLinks > Math.max(4, nodes.length * 0.1)) {
        method = 'grid'
        positions = gridPositions(nodes, sizes, direction)
      }
      else {
        for (const node of nodes)
          dagreGraph.setNode(node.id, sizes.get(node.id)!)
        for (const [source, target] of links) {
          dagreGraph.setEdge(source, target)
        }
        try {
          dagre.layout(dagreGraph)
          positions = new Map(nodes.map((node) => {
            const item = dagreGraph.node(node.id)
            if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y))
              throw new Error('Invalid layout position')
            return [node.id, { x: item.x - item.width / 2, y: item.y - item.height / 2 }]
          }))
          if (nodes.length > 24) {
            let right = 0
            let bottom = 0
            for (const [id, position] of positions) {
              const size = sizes.get(id)!
              right = Math.max(right, position.x + size.width)
              bottom = Math.max(bottom, position.y + size.height)
            }
            // A few branches should not turn a long chapter into an unreadable
            // horizontal or vertical strip at the initial overview scale.
            if (right / Math.max(1, bottom) > 24 || bottom / Math.max(1, right) > 24) {
              method = 'grid'
              positions = gridPositions(nodes, sizes, direction)
            }
          }
        }
        catch {
          method = 'grid'
          positions = gridPositions(nodes, sizes, direction)
        }
      }
      entry = { positions, method }
      cache.set(key, entry)
      while (cache.size > MAX_CACHED_LAYOUTS)
        cache.delete(cache.keys().next().value!)
      stats.value = { ...stats.value, runs: stats.value.runs + 1, fallbacks: stats.value.fallbacks + Number(method === 'grid') }
    }
    const horizontal = direction === 'LR'
    return nodes.map(node => ({
      ...node,
      targetPosition: horizontal ? Position.Left : Position.Top,
      sourcePosition: horizontal ? Position.Right : Position.Bottom,
      position: { ...entry.positions.get(node.id)! },
    }))
  }

  return { graph, layout, stats, clear }
}
