import dagre from '@dagrejs/dagre'

export interface NativeFlowLayoutPosition { x: number, y: number }
export interface NativeFlowLayoutNode {
  id: string
  position?: NativeFlowLayoutPosition
  width: number
  height: number
}
export interface NativeFlowLayoutEdge { id: string, source: string, target: string }

const MARGIN = 32
const COLUMN_GAP = 144
const ROW_GAP = 64
const MAX_DAGRE_NODES = 200
const MAX_COORDINATE = 1e9
const MAX_DIMENSION = 1e6

type SizedNode = NativeFlowLayoutNode & { width: number, height: number }
interface Rectangle extends NativeFlowLayoutPosition { width: number, height: number }

function dimension(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 && value <= MAX_DIMENSION ? value : fallback
}

function validPosition(position?: NativeFlowLayoutPosition): position is NativeFlowLayoutPosition {
  return !!position && Number.isFinite(position.x) && Number.isFinite(position.y)
    && Math.abs(position.x) <= MAX_COORDINATE && Math.abs(position.y) <= MAX_COORDINATE
}

/** Spatial buckets keep collision checks bounded for large imported chapters. */
function occupancy(nodes: SizedNode[]) {
  let cellWidth = COLUMN_GAP
  let cellHeight = ROW_GAP
  for (const node of nodes) {
    cellWidth = Math.max(cellWidth, node.width + COLUMN_GAP)
    cellHeight = Math.max(cellHeight, node.height + ROW_GAP)
  }
  const buckets = new Map<string, Rectangle[]>()
  function keys(rect: Rectangle) {
    const result: string[] = []
    for (let x = Math.floor(rect.x / cellWidth); x <= Math.floor((rect.x + rect.width) / cellWidth); x++) {
      for (let y = Math.floor(rect.y / cellHeight); y <= Math.floor((rect.y + rect.height) / cellHeight); y++)
        result.push(`${x}:${y}`)
    }
    return result
  }
  return {
    add(rect: Rectangle) {
      for (const key of keys(rect)) {
        const bucket = buckets.get(key) ?? []
        bucket.push(rect)
        buckets.set(key, bucket)
      }
    },
    intersects(rect: Rectangle, gutter = false) {
      const query = gutter
        ? { x: rect.x - COLUMN_GAP, y: rect.y - ROW_GAP, width: rect.width + COLUMN_GAP * 2, height: rect.height + ROW_GAP * 2 }
        : rect
      return keys(query).some(key => buckets.get(key)?.some(other =>
        query.x < other.x + other.width && query.x + query.width > other.x
        && query.y < other.y + other.height && query.y + query.height > other.y))
    },
  }
}

/** Compact, size-aware rows; no recursive graph traversal in the fallback. */
function gridPositions(nodes: SizedNode[]) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)))
  const widths = Array.from<number>({ length: columns }).fill(0)
  const heights = Array.from<number>({ length: Math.ceil(nodes.length / columns) }).fill(0)
  nodes.forEach((node, index) => {
    widths[index % columns] = Math.max(widths[index % columns], node.width)
    heights[Math.floor(index / columns)] = Math.max(heights[Math.floor(index / columns)], node.height)
  })
  const offsets = (sizes: number[], gap: number) => {
    let cursor = MARGIN
    return sizes.map((size) => {
      const result = cursor
      cursor += size + gap
      return result
    })
  }
  const xs = offsets(widths, COLUMN_GAP)
  const ys = offsets(heights, ROW_GAP)
  return new Map(nodes.map((node, index) => [node.id, { x: xs[index % columns], y: ys[Math.floor(index / columns)] }]))
}

function automaticPositions(nodes: SizedNode[], edges: readonly NativeFlowLayoutEdge[]) {
  if (nodes.length > MAX_DAGRE_NODES)
    return gridPositions(nodes)
  const ids = new Set(nodes.map(node => node.id))
  const links = [...new Set(edges.filter(edge => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target)
    .map(edge => JSON.stringify([edge.source, edge.target])))].sort()
  if (links.length > Math.max(120, nodes.length * 3))
    return gridPositions(nodes)
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'LR', ranker: 'longest-path', ranksep: COLUMN_GAP, nodesep: ROW_GAP, edgesep: 32, marginx: MARGIN, marginy: MARGIN })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const node of nodes)
    graph.setNode(node.id, { width: node.width, height: node.height })
  for (const link of links) {
    const [source, target] = JSON.parse(link) as [string, string]
    graph.setEdge(source, target)
  }
  try {
    dagre.layout(graph)
    const result = new Map<string, NativeFlowLayoutPosition>()
    const occupied = occupancy(nodes)
    let right = MARGIN
    let bottom = MARGIN
    for (const node of nodes) {
      const laidOut = graph.node(node.id)
      const position = { x: laidOut.x - node.width / 2, y: laidOut.y - node.height / 2 }
      const rect = { ...position, width: node.width, height: node.height }
      if (!validPosition(position) || occupied.intersects(rect))
        return gridPositions(nodes)
      occupied.add(rect)
      result.set(node.id, position)
      right = Math.max(right, position.x + node.width)
      bottom = Math.max(bottom, position.y + node.height)
    }
    // Keep long chapters visible at an overview scale, rather than a thin strip.
    if (nodes.length > 40 && Math.max(right / bottom, bottom / right) > 12)
      return gridPositions(nodes)
    return result
  }
  catch {
    return gridPositions(nodes)
  }
}

/**
 * Pure renderer projection. Authored coordinates win when finite and disjoint;
 * collisions retain the first stable ID. Explicit auto-layout replaces all positions.
 * Text, edge labels and input ordering cannot change the generated layout.
 */
export function layoutNativeFlow(
  input: readonly NativeFlowLayoutNode[],
  edges: readonly NativeFlowLayoutEdge[],
  options: { force?: boolean } = {},
): Map<string, NativeFlowLayoutPosition> {
  const nodes = input.map(node => ({ ...node, width: dimension(node.width, 280), height: dimension(node.height, 160) }))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const result = new Map<string, NativeFlowLayoutPosition>()
  if (!nodes.length)
    return result
  const occupied = occupancy(nodes)
  let right = MARGIN
  if (!options.force) {
    for (const node of nodes) {
      if (!validPosition(node.position))
        continue
      const rect = { ...node.position, width: node.width, height: node.height }
      if (occupied.intersects(rect))
        continue
      occupied.add(rect)
      result.set(node.id, { ...node.position })
      right = Math.max(right, rect.x + rect.width)
    }
  }
  if (result.size === nodes.length)
    return result
  const automatic = automaticPositions(nodes, edges)
  if (!result.size)
    return automatic
  const pending = nodes.filter(node => !result.has(node.id))
  const fallback = gridPositions(pending)
  // A separate strip is guaranteed clear even when authored anchors surround
  // an automatic position. It also avoids unbounded "nudge until free" loops.
  for (const node of nodes)
    right = Math.max(right, automatic.get(node.id)!.x + node.width)
  const repairOffset = right + COLUMN_GAP
  for (const node of pending) {
    let position = automatic.get(node.id)!
    if (occupied.intersects({ ...position, width: node.width, height: node.height }, true)) {
      const repair = fallback.get(node.id)!
      position = { x: repairOffset + repair.x, y: repair.y }
    }
    result.set(node.id, { ...position })
    occupied.add({ ...position, width: node.width, height: node.height })
  }
  return result
}
