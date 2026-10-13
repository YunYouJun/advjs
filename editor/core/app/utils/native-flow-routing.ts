/** World-space bounds, including the complete rendered node body. */
export interface NativeFlowObstacle {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export interface NativeFlowRoutePoint {
  x: number
  y: number
}

export interface NativeFlowRouteInput {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourceId: string
  targetId: string
  obstacles: readonly NativeFlowObstacle[]
  laneIndex?: number
  laneCount?: number
  clearance?: number
  /** Disable badge placement work for ordinary, unlabelled edges. */
  label?: boolean
  /** Optional counters for profiling and structural performance tests. */
  diagnostics?: NativeFlowRoutingDiagnostics
}

export interface NativeFlowRoutingDiagnostics {
  preparedObstacles: number
  segmentObstacleChecks: number
  badgeObstacleChecks: number
  fullScanQueries: number
}

export interface NativeFlowRoute {
  path: string
  label: NativeFlowRoutePoint
  points: NativeFlowRoutePoint[]
  /** False when overlapping nodes/blocked ports or the bounded search prevent a clear route. */
  obstacleFree: boolean
}

interface Rect {
  id: string
  left: number
  right: number
  top: number
  bottom: number
}

interface SpatialIndex {
  rects: Rect[]
  cells: Map<string, Rect[]>
  oversized: Rect[]
}

interface PreparedObstacles {
  index: SpatialIndex
  byId: Map<string, Rect[]>
  bounds: Rect
  badges?: SpatialIndex
}

// Callers replace this readonly snapshot when positions/dimensions change. Identity
// caching avoids scanning every node for every edge during the same render/drag tick.
const obstacleCache = new WeakMap<readonly NativeFlowObstacle[], Map<number, PreparedObstacles>>()
const cellSize = 384

function spatialIndex(rects: Rect[]): SpatialIndex {
  const index: SpatialIndex = { rects, cells: new Map(), oversized: [] }
  for (const rect of rects) {
    const left = Math.floor(rect.left / cellSize)
    const right = Math.floor(rect.right / cellSize)
    const top = Math.floor(rect.top / cellSize)
    const bottom = Math.floor(rect.bottom / cellSize)
    if (![left, right, top, bottom].every(Number.isSafeInteger) || (right - left + 1) * (bottom - top + 1) > 64) {
      index.oversized.push(rect)
      continue
    }
    for (let x = left; x <= right; x++) {
      for (let y = top; y <= bottom; y++) {
        const key = `${x}:${y}`
        const bucket = index.cells.get(key)
        if (bucket)
          bucket.push(rect)
        else
          index.cells.set(key, [rect])
      }
    }
  }
  return index
}

function nearby(index: SpatialIndex, a: NativeFlowRoutePoint, b: NativeFlowRoutePoint, diagnostics?: NativeFlowRoutingDiagnostics): Iterable<Rect> {
  const left = Math.floor(Math.min(a.x, b.x) / cellSize)
  const right = Math.floor(Math.max(a.x, b.x) / cellSize)
  const top = Math.floor(Math.min(a.y, b.y) / cellSize)
  const bottom = Math.floor(Math.max(a.y, b.y) / cellSize)
  // Extremely long segments must not allocate or walk an enormous empty grid.
  if (![left, right, top, bottom].every(Number.isSafeInteger) || (right - left + 1) * (bottom - top + 1) > 256) {
    if (diagnostics)
      diagnostics.fullScanQueries++
    return index.rects
  }
  const result = new Set(index.oversized)
  for (let x = left; x <= right; x++) {
    for (let y = top; y <= bottom; y++) {
      const bucket = index.cells.get(`${x}:${y}`)
      if (bucket) {
        for (const rect of bucket)
          result.add(rect)
      }
    }
  }
  return result
}

function prepare(obstacles: readonly NativeFlowObstacle[], clearance: number, diagnostics?: NativeFlowRoutingDiagnostics) {
  let variants = obstacleCache.get(obstacles)
  const cached = variants?.get(clearance)
  if (cached)
    return cached
  if (!variants) {
    variants = new Map()
    obstacleCache.set(obstacles, variants)
  }
  const rects: Rect[] = obstacles.filter(rect => [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) && rect.width >= 0 && rect.height >= 0).map(rect => ({
    id: rect.id,
    left: rect.x - clearance,
    right: rect.x + rect.width + clearance,
    top: rect.y - clearance,
    bottom: rect.y + rect.height + clearance,
  }))
  const byId = new Map<string, Rect[]>()
  const bounds: Rect = { id: '', left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity }
  for (const rect of rects) {
    const existing = byId.get(rect.id)
    if (existing)
      existing.push(rect)
    else
      byId.set(rect.id, [rect])
    bounds.left = Math.min(bounds.left, rect.left)
    bounds.right = Math.max(bounds.right, rect.right)
    bounds.top = Math.min(bounds.top, rect.top)
    bounds.bottom = Math.max(bounds.bottom, rect.bottom)
  }
  const prepared: PreparedObstacles = { index: spatialIndex(rects), byId, bounds }
  if (variants.size >= 4)
    variants.delete(variants.keys().next().value!)
  variants.set(clearance, prepared)
  if (diagnostics)
    diagnostics.preparedObstacles += obstacles.length
  return prepared
}

const epsilon = 0.001

function finite(value: number, fallback = 0) {
  return Number.isFinite(value) ? value : fallback
}

function intersects(a: NativeFlowRoutePoint, b: NativeFlowRoutePoint, rect: Rect) {
  if (a.x === b.x)
    return a.x > rect.left + epsilon && a.x < rect.right - epsilon && Math.max(a.y, b.y) > rect.top + epsilon && Math.min(a.y, b.y) < rect.bottom - epsilon
  return a.y > rect.top + epsilon && a.y < rect.bottom - epsilon && Math.max(a.x, b.x) > rect.left + epsilon && Math.min(a.x, b.x) < rect.right - epsilon
}

function clear(a: NativeFlowRoutePoint, b: NativeFlowRoutePoint, index: SpatialIndex, ignore?: string, diagnostics?: NativeFlowRoutingDiagnostics) {
  for (const rect of nearby(index, a, b, diagnostics)) {
    if (diagnostics)
      diagnostics.segmentObstacleChecks++
    if (rect.id !== ignore && intersects(a, b, rect))
      return false
  }
  return true
}

function simplify(points: NativeFlowRoutePoint[]) {
  const result: NativeFlowRoutePoint[] = []
  for (const point of points) {
    const previous = result.at(-1)
    if (previous?.x === point.x && previous.y === point.y)
      continue
    const before = result.at(-2)
    if (before && previous && ((before.x === previous.x && previous.x === point.x) || (before.y === previous.y && previous.y === point.y))) {
      // Only collapse straight travel, never a reversal around a port.
      if ((previous.x - before.x) * (point.x - previous.x) >= 0 && (previous.y - before.y) * (point.y - previous.y) >= 0)
        result.pop()
    }
    result.push(point)
  }
  return result
}

function length(a: NativeFlowRoutePoint, b: NativeFlowRoutePoint) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Small bounded rectilinear visibility grid, used only if the cheap corridor routes fail.
 * At most 36 coordinates per axis and 1,296 visited vertices, independent of graph size.
 * Every accepted segment is checked against ALL obstacles, including omitted grid corners.
 */
function search(start: NativeFlowRoutePoint, end: NativeFlowRoutePoint, index: SpatialIndex, outer: Rect, diagnostics?: NativeFlowRoutingDiagnostics) {
  const relevant = [...index.rects].sort((a, b) => {
    const distance = (rect: Rect) => Math.max(0, rect.left - Math.max(start.x, end.x), Math.min(start.x, end.x) - rect.right) + Math.max(0, rect.top - Math.max(start.y, end.y), Math.min(start.y, end.y) - rect.bottom)
    return distance(a) - distance(b) || a.left - b.left || a.top - b.top || a.id.localeCompare(b.id)
  }).slice(0, 16)
  const xs = [...new Set([start.x, end.x, outer.left, outer.right, ...relevant.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b)
  const ys = [...new Set([start.y, end.y, outer.top, outer.bottom, ...relevant.flatMap(rect => [rect.top, rect.bottom])])].sort((a, b) => a - b)
  const width = xs.length
  const key = (x: number, y: number) => y * width + x
  const point = (id: number) => ({ x: xs[id % width]!, y: ys[Math.floor(id / width)]! })
  const first = key(xs.indexOf(start.x), ys.indexOf(start.y))
  const last = key(xs.indexOf(end.x), ys.indexOf(end.y))
  const scores = new Map([[first, 0]])
  const parents = new Map<number, number>()
  const open = new Set([first])
  const closed = new Set<number>()
  while (open.size) {
    let current = -1
    let best = Number.POSITIVE_INFINITY
    for (const id of open) {
      const score = scores.get(id)! + length(point(id), end)
      if (score < best) {
        best = score
        current = id
      }
    }
    if (current === last) {
      const route = [point(current)]
      while (parents.has(current)) {
        current = parents.get(current)!
        route.push(point(current))
      }
      return route.reverse()
    }
    open.delete(current)
    closed.add(current)
    const x = current % width
    const y = Math.floor(current / width)
    const neighbours = [x > 0 ? current - 1 : -1, x + 1 < width ? current + 1 : -1, y > 0 ? current - width : -1, y + 1 < ys.length ? current + width : -1]
    for (const next of neighbours) {
      if (next < 0 || closed.has(next) || !clear(point(current), point(next), index, undefined, diagnostics))
        continue
      const score = scores.get(current)! + length(point(current), point(next))
      if (score < (scores.get(next) ?? Number.POSITIVE_INFINITY)) {
        scores.set(next, score)
        parents.set(next, current)
        open.add(next)
      }
    }
  }
  return undefined
}

/** Route a right-facing output to a left-facing input, independently of node layout. */
export function routeNativeFlowEdge(input: NativeFlowRouteInput): NativeFlowRoute {
  const source = { x: finite(input.sourceX), y: finite(input.sourceY) }
  const target = { x: finite(input.targetX), y: finite(input.targetY) }
  const clearance = Math.max(12, Math.min(64, finite(input.clearance ?? 16, 16)))
  const lane = Math.max(0, Math.min(10000, Math.floor(finite(input.laneIndex ?? 0))))
  // More than nine sibling lanes reuse exterior gutters instead of making the
  // canvas grow with the total edge count. Badges still use the full lane order.
  const spread = Math.min(lane, 8) * 10
  const diagnostics = input.diagnostics
  if (diagnostics) {
    diagnostics.preparedObstacles = 0
    diagnostics.segmentObstacleChecks = 0
    diagnostics.badgeObstacleChecks = 0
    diagnostics.fullScanQueries = 0
  }
  const prepared = prepare(input.obstacles, clearance, diagnostics)
  const index = prepared.index
  // Handles can be centred slightly inside a padded row or outside the body.
  // Escape the actual inflated body before starting obstacle-avoiding travel.
  const sourceRects = prepared.byId.get(input.sourceId) ?? []
  const targetRects = prepared.byId.get(input.targetId) ?? []
  const start = { x: Math.max(source.x + clearance, ...sourceRects.map(rect => rect.right)), y: source.y }
  const end = { x: Math.min(target.x - clearance, ...targetRects.map(rect => rect.left)), y: target.y }
  const outer: Rect = {
    id: '',
    left: Math.min(start.x, end.x, prepared.bounds.left),
    right: Math.max(start.x, end.x, prepared.bounds.right),
    top: Math.min(start.y, end.y, prepared.bounds.top),
    bottom: Math.max(start.y, end.y, prepared.bounds.bottom),
  }
  outer.left -= clearance + spread
  outer.right += clearance + spread
  outer.top -= clearance + spread
  outer.bottom += clearance + spread
  const terminalRects = [...sourceRects, ...targetRects]
  const top = Math.min(source.y, target.y, ...terminalRects.map(rect => rect.top)) - spread
  const bottom = Math.max(source.y, target.y, ...terminalRects.map(rect => rect.bottom)) + spread
  const preferredMiddleX = (start.x + end.x) / 2 + (lane - Math.max(0, finite(input.laneCount ?? 1) - 1) / 2) * 10
  // A high/global lane index must never push a forward bend through either body.
  const middleX = Math.max(start.x, Math.min(end.x, preferredMiddleX))
  const candidates: NativeFlowRoutePoint[][] = []
  if (start.x <= end.x && input.sourceId !== input.targetId) {
    candidates.push([start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end])
  }
  for (const y of [top, bottom, outer.top, outer.bottom])
    candidates.push([start, { x: start.x, y }, { x: end.x, y }, end])
  for (const x of [outer.left, outer.right])
    candidates.push([start, { x, y: start.y }, { x, y: end.y }, end])
  const candidate = candidates.find(points => points.every((point, index) => index === 0 || clear(points[index - 1]!, point, prepared.index, undefined, diagnostics)))
  const routed = candidate ?? search(start, end, index, outer, diagnostics)
  // A visible fallback is preferable to a missing edge; callers can style/diagnose it.
  const points = simplify([source, ...(routed ?? candidates[0]!), target])
  const terminalsClear = clear(source, start, index, input.sourceId, diagnostics) && clear(end, target, index, input.targetId, diagnostics)
  let label = { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 }
  if (input.label !== false) {
    // Reserve the entire 58 × 20 badge plus a 4 px gap, not just its centre.
    prepared.badges ??= spatialIndex(index.rects.map(rect => ({
      ...rect,
      left: rect.left + clearance - 33,
      right: rect.right - clearance + 33,
      top: rect.top + clearance - 14,
      bottom: rect.bottom - clearance + 14,
    })))
    const laneCount = Math.max(lane + 1, Math.floor(finite(input.laneCount ?? 1, 1)))
    const fraction = (lane + 0.5) / laneCount
    // If a tight/blocked route has no space for a badge, keep it clear above the graph.
    label = { x: source.x + Math.min(lane, 8) * 66, y: outer.top - 14 }
    let longest = -1
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]!
      const b = points[index]!
      if (length(a, b) <= longest)
        continue
      const horizontal = a.y === b.y
      const low = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
      const high = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
      const badgeRects = [...nearby(prepared.badges, a, b, diagnostics)]
      if (diagnostics)
        diagnostics.badgeObstacleChecks += badgeRects.length
      const blocked = badgeRects.filter(rect => horizontal
        ? a.y > rect.top && a.y < rect.bottom
        : a.x > rect.left && a.x < rect.right)
        .map(rect => horizontal ? [rect.left, rect.right] as const : [rect.top, rect.bottom] as const)
        .filter(([left, right]) => right > low && left < high)
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      const gaps: Array<readonly [number, number]> = []
      let cursor = low
      for (const [left, right] of blocked) {
        if (left > cursor)
          gaps.push([cursor, Math.min(left, high)])
        cursor = Math.max(cursor, right)
        if (cursor >= high)
          break
      }
      if (cursor < high)
        gaps.push([cursor, high])
      const available = gaps.reduce((sum, [left, right]) => sum + right - left, 0)
      if (available <= 0)
        continue
      // Spread labels over available space even when coincident edges share a straight run.
      let offset = available * fraction
      for (const [left, right] of gaps) {
        if (offset <= right - left) {
          label = horizontal ? { x: left + offset, y: a.y } : { x: a.x, y: left + offset }
          longest = length(a, b)
          break
        }
        offset -= right - left
      }
    }
  }
  return {
    path: points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '),
    label,
    points,
    obstacleFree: Boolean(routed) && terminalsClear && [input.sourceX, input.sourceY, input.targetX, input.targetY].every(Number.isFinite),
  }
}
