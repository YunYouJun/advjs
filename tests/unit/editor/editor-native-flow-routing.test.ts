import type { NativeFlowObstacle, NativeFlowRouteInput, NativeFlowRoutingDiagnostics } from '../../../editor/core/app/utils/native-flow-routing'
import { describe, expect, it } from 'vitest'
import { routeNativeFlowEdge } from '../../../editor/core/app/utils/native-flow-routing'

const node = (id: string, x: number, y: number, width = 200, height = 100): NativeFlowObstacle => ({ id, x, y, width, height })

function input(source: NativeFlowObstacle, target: NativeFlowObstacle, others: NativeFlowObstacle[] = [], laneIndex = 0): NativeFlowRouteInput {
  return {
    sourceX: source.x + source.width,
    sourceY: source.y + source.height / 2,
    targetX: target.x,
    targetY: target.y + target.height / 2,
    sourceId: source.id,
    targetId: target.id,
    obstacles: source.id === target.id ? [source, ...others] : [source, target, ...others],
    laneIndex,
  }
}

function expectClear(config: NativeFlowRouteInput) {
  const result = routeNativeFlowEdge(config)
  expect(result.obstacleFree).toBe(true)
  expect(result.path).not.toMatch(/NaN|Infinity/)
  expect(result.points[0]).toEqual({ x: config.sourceX, y: config.sourceY })
  expect(result.points.at(-1)).toEqual({ x: config.targetX, y: config.targetY })
  expect(result.points[1]!.x).toBeGreaterThan(config.sourceX)
  expect(result.points.at(-2)!.x).toBeLessThan(config.targetX)
  for (let index = 1; index < result.points.length; index++) {
    const a = result.points[index - 1]!
    const b = result.points[index]!
    expect(a.x === b.x || a.y === b.y).toBe(true)
    for (const rect of config.obstacles) {
      const crosses = a.x === b.x
        ? a.x > rect.x && a.x < rect.x + rect.width && Math.max(a.y, b.y) > rect.y && Math.min(a.y, b.y) < rect.y + rect.height
        : a.y > rect.y && a.y < rect.y + rect.height && Math.max(a.x, b.x) > rect.x && Math.min(a.x, b.x) < rect.x + rect.width
      expect(crosses, `segment ${index} intersects ${rect.id}`).toBe(false)
    }
  }
  for (const rect of config.obstacles) {
    const labelInside = result.label.x > rect.x - 29 && result.label.x < rect.x + rect.width + 29 && result.label.y > rect.y - 10 && result.label.y < rect.y + rect.height + 10
    expect(labelInside, `badge overlaps ${rect.id}`).toBe(false)
  }
  return result
}

describe('native Flow orthogonal edge routing', () => {
  it('routes forward edges from real right/left ports with a clear badge', () => {
    expectClear(input(node('a', 0, 0), node('b', 400, 180)))
    expectClear(input(node('a', 0, 0), node('b', 400, 0)))
  })

  it('escapes real body bounds for inset ports while retaining exact endpoints', () => {
    const config = {
      ...input(node('a', 0, 0, 260, 100), node('b', 500, 220)),
      sourceX: 255.5,
      targetX: 511,
    }
    const route = routeNativeFlowEdge(config)
    expect(route.obstacleFree).toBe(true)
    expect(route.points[0]).toEqual({ x: 255.5, y: 50 })
    expect(route.points.at(-1)).toEqual({ x: 511, y: 270 })
    expect(route.points[1]!.x).toBeGreaterThanOrEqual(276)
    expect(route.points.at(-2)!.x).toBeLessThanOrEqual(484)
    // Only each own terminal stub may cross its node body; other bodies still block it.
    expect(routeNativeFlowEdge({
      ...config,
      obstacles: [...config.obstacles, node('blocks-source-stub', 262, 40, 10, 20)],
    }).obstacleFree).toBe(false)
    expect(routeNativeFlowEdge({
      ...config,
      obstacles: [...config.obstacles, node('blocks-target-stub', 486, 260, 10, 20)],
    }).obstacleFree).toBe(false)
  })

  it('keeps external port centres exact without turning through a body', () => {
    expectClear({ ...input(node('a', 0, 0), node('b', 500, 220)), sourceX: 205, targetX: 495 })
  })

  it('keeps high-index forward lanes inside the local gap', () => {
    const config = {
      ...input(node('a', 0, 0, 260, 140), node('b', 404, 0, 260, 140)),
      sourceX: 264.5,
      sourceY: 125,
      targetX: 399.5,
      targetY: 70,
      laneIndex: 98,
      laneCount: 99,
    }
    const route = expectClear(config)
    expect(Math.min(...route.points.map(point => point.y))).toBe(70)
    expect(Math.max(...route.points.map(point => point.y))).toBe(125)
    expect(Math.min(...route.points.map(point => point.x))).toBe(264.5)
    expect(Math.max(...route.points.map(point => point.x))).toBe(399.5)
  })

  it('bounds high-index exterior lanes instead of scaling detours with edge count', () => {
    const config = input(node('a', 404, 0, 260, 140), node('b', 0, 0, 260, 140))
    const route = expectClear({ ...config, laneIndex: 98, laneCount: 99 })
    expect(Math.min(...route.points.map(point => point.y))).toBeGreaterThanOrEqual(-112)
    expect(Math.max(...route.points.map(point => point.y))).toBeLessThanOrEqual(252)
    // Saturation deliberately reuses exterior lanes; full badge order remains distinct.
    expect(routeNativeFlowEdge({ ...config, laneIndex: 1000, laneCount: 1001 }).path).toBe(route.path)
  })

  it('routes reverse edges outside both node bodies and separates lanes', () => {
    const config = input(node('a', 400, 0), node('b', 0, 0))
    const first = expectClear(config)
    const second = expectClear({ ...config, laneIndex: 1, laneCount: 2 })
    expect(second.path).not.toBe(first.path)
    expect(second.label).not.toEqual(first.label)
  })

  it('routes same-column links and self-loops around the entire node', () => {
    expectClear(input(node('a', 0, 0), node('b', 0, 220)))
    expectClear(input(node('self', 40, 60, 320, 240), node('self', 40, 60, 320, 240)))
  })

  it('avoids an intervening node rather than using a centre-to-centre line', () => {
    expectClear(input(node('a', 0, 0), node('b', 800, 0), [node('block', 350, -100, 300, 300)]))
  })

  it('uses obstacle corners when both simple vertical escape corridors are blocked', () => {
    expectClear(input(node('a', 0, 0), node('b', 700, 300), [
      node('above-a', 170, -180, 130, 130),
      node('below-a', 170, 150, 130, 130),
      node('above-b', 600, 100, 130, 130),
      node('below-b', 600, 450, 130, 130),
      node('middle', 350, 0, 180, 400),
    ]))
  })

  it('handles dense cyclic graphs deterministically regardless of obstacle order', () => {
    const nodes = Array.from({ length: 30 }, (_, index) => node(`n${index}`, (index % 6) * 320, Math.floor(index / 6) * 180))
    for (let index = 0; index < nodes.length; index++) {
      const source = nodes[index]!
      const target = nodes[(index * 7 + 11) % nodes.length]!
      const config = input(source, target, nodes.filter(rect => rect.id !== source.id && rect.id !== target.id), index % 3)
      const route = expectClear(config)
      expect(routeNativeFlowEdge(config)).toEqual(route)
      expect(routeNativeFlowEdge({ ...config, obstacles: [...config.obstacles].reverse() })).toEqual(route)
    }
  })

  it('reserves the whole 58 by 20 badge beside narrow gaps and tall nodes', () => {
    expectClear(input(node('a', 0, 0, 200, 600), node('b', 245, 700, 200, 600)))
    const config = input(node('a', 0, 0), node('b', 245, 0))
    const route = expectClear(config)
    // The 45 px node gap cannot hold a 58 px badge, so use the clear exterior.
    expect(route.label.y).toBeLessThan(0)
  })

  it('spreads badges for coincident runs when the shared segment has room', () => {
    const config = input(node('a', 0, 0), node('b', 1000, 0))
    const routes = Array.from({ length: 4 }, (_, laneIndex) => expectClear({ ...config, laneIndex, laneCount: 4 }))
    expect(new Set(routes.map(route => route.path)).size).toBe(1)
    for (let index = 1; index < routes.length; index++)
      expect(routes[index]!.label.x - routes[index - 1]!.label.x).toBeGreaterThan(58)
    expect(routeNativeFlowEdge({ ...config, laneIndex: 2, laneCount: 4 })).toEqual(routes[2])
  })

  it('shares preprocessing and queries local bins instead of scanning the full graph', () => {
    const obstacles = Array.from({ length: 2800 }, (_, index) => node(`n${index}`, (index % 70) * 404, Math.floor(index / 70) * 220, 260, 140))
    const diagnostics: NativeFlowRoutingDiagnostics = { preparedObstacles: 0, segmentObstacleChecks: 0, badgeObstacleChecks: 0, fullScanQueries: 0 }
    const config = { ...input(obstacles[0]!, obstacles[1]!), obstacles, label: false, diagnostics }
    expect(routeNativeFlowEdge(config).obstacleFree).toBe(true)
    expect(diagnostics.preparedObstacles).toBe(2800)
    expect(diagnostics.segmentObstacleChecks).toBeLessThan(50)
    expect(diagnostics.badgeObstacleChecks).toBe(0)
    expect(diagnostics.fullScanQueries).toBe(0)
    expect(routeNativeFlowEdge({ ...config, ...input(obstacles[1]!, obstacles[2]!), obstacles }).obstacleFree).toBe(true)
    expect(diagnostics.preparedObstacles).toBe(0)
    expect(diagnostics.segmentObstacleChecks).toBeLessThan(50)
    const labelled = routeNativeFlowEdge({ ...config, label: true })
    expect(labelled.obstacleFree).toBe(true)
    expect(diagnostics.badgeObstacleChecks).toBeGreaterThan(0)
    expect(diagnostics.badgeObstacleChecks).toBeLessThan(50)
    expect(diagnostics.preparedObstacles).toBe(0)
    // A fresh snapshot after dragging invalidates preprocessing and detects the new overlap.
    const moved = [...obstacles]
    moved[1] = { ...moved[1]!, x: 250 }
    expect(routeNativeFlowEdge({ ...config, obstacles: moved }).obstacleFree).toBe(false)
    expect(diagnostics.preparedObstacles).toBe(2800)
  })

  it('bounds cached clearance variants per obstacle snapshot', () => {
    const config = input(node('a', 0, 0), node('b', 500, 0))
    const diagnostics: NativeFlowRoutingDiagnostics = { preparedObstacles: 0, segmentObstacleChecks: 0, badgeObstacleChecks: 0, fullScanQueries: 0 }
    for (const clearance of [12, 13, 14, 15, 16])
      routeNativeFlowEdge({ ...config, clearance, diagnostics })
    routeNativeFlowEdge({ ...config, clearance: 16, diagnostics })
    expect(diagnostics.preparedObstacles).toBe(0)
    routeNativeFlowEdge({ ...config, clearance: 12, diagnostics })
    expect(diagnostics.preparedObstacles).toBe(2)
  })

  it('checks oversized obstacles and bounds extremely long spatial queries', () => {
    const diagnostics: NativeFlowRoutingDiagnostics = { preparedObstacles: 0, segmentObstacleChecks: 0, badgeObstacleChecks: 0, fullScanQueries: 0 }
    expectClear({
      ...input(node('a', 0, 0), node('b', 1000000, 0), [node('wide-block', 10000, -100, 900000, 300)]),
      diagnostics,
    })
    expect(diagnostics.fullScanQueries).toBeGreaterThan(0)
  })

  it('reports blocked ports as fallback instead of claiming obstacle-free routing', () => {
    const route = routeNativeFlowEdge(input(node('a', 0, 0), node('b', 600, 0), [node('overlap', 190, 0, 180, 100)]))
    expect(route.obstacleFree).toBe(false)
    expect(route.path).not.toMatch(/NaN|Infinity/)
  })

  it('keeps malformed coordinates finite and marks the result unverified', () => {
    const route = routeNativeFlowEdge({ ...input(node('a', 0, 0), node('b', 500, 0)), sourceX: Number.NaN, targetY: Number.POSITIVE_INFINITY })
    expect(route.obstacleFree).toBe(false)
    expect(route.path).not.toMatch(/NaN|Infinity/)
  })
})
