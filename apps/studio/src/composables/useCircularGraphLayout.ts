import type { ComputedRef } from 'vue'
import { computed } from 'vue'

export const SVG_SIZE = 500
export const SVG_CENTER = 250

export interface GraphNode {
  id: string
  name: string
  x: number
  y: number
}

export interface GraphEdge {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  mx: number
  my: number
}

/**
 * Compute circular layout positions for N items.
 *
 * @param items - Reactive array of items to layout
 * @param getId - Extract id from item
 * @param getName - Extract display name from item
 * @param getExtra - Optionally extract extra fields to merge into the node
 * @param options - Layout options
 * @param options.smallRadius - Radius used when item count is below threshold
 * @param options.largeRadius - Radius used when item count is at or above threshold
 * @param options.threshold - Item count threshold to switch between small and large radius
 */
export function useCircularLayout<T, E extends Record<string, any> = Record<string, never>>(
  items: ComputedRef<T[]>,
  getId: (item: T) => string,
  getName: (item: T) => string,
  getExtra?: (item: T) => E,
  options: { smallRadius?: number, largeRadius?: number, threshold?: number } = {},
) {
  const {
    smallRadius = 180,
    largeRadius = 240,
    threshold = 10,
  } = options

  const radius = computed(() => items.value.length <= threshold ? smallRadius : largeRadius)

  type FullNode = GraphNode & E

  const nodes = computed<FullNode[]>(() => {
    const n = items.value.length
    return items.value.map((item, i) => {
      const angle = (i * 2 * Math.PI) / n - Math.PI / 2
      const base: GraphNode = {
        id: getId(item),
        name: getName(item),
        x: SVG_CENTER + radius.value * Math.cos(angle),
        y: SVG_CENTER + radius.value * Math.sin(angle),
      }
      const extra = getExtra ? getExtra(item) : {} as E
      return { ...base, ...extra } as FullNode
    })
  })

  const nodeMap = computed<Map<string, FullNode>>(() => {
    const m = new Map<string, FullNode>()
    for (const n of nodes.value)
      m.set(n.id, n)
    return m
  })

  return { radius, nodes, nodeMap }
}

/**
 * Compute edge endpoints offset from node center by nodeRadius.
 * Returns x1/y1/x2/y2/mx/my for drawing a line between two nodes.
 */
export function computeEdgeEndpoints(
  nodeA: GraphNode,
  nodeB: GraphNode,
  nodeRadius: number,
): GraphEdge {
  const dx = nodeB.x - nodeA.x
  const dy = nodeB.y - nodeA.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const nx = dx / dist
  const ny = dy / dist

  return {
    key: `${nodeA.id}↔${nodeB.id}`,
    x1: nodeA.x + nx * nodeRadius,
    y1: nodeA.y + ny * nodeRadius,
    x2: nodeB.x - nx * nodeRadius,
    y2: nodeB.y - ny * nodeRadius,
    mx: (nodeA.x + nodeB.x) / 2,
    my: (nodeA.y + nodeB.y) / 2,
  }
}
