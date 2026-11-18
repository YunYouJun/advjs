import type { RuntimeAddress, RuntimeChoice, RuntimeNode, RuntimeProgram } from '@advjs/types'

export interface RuntimeRouteNode {
  /** `chapterId#nodeId`, the same key as `RuntimeState.visited`. */
  id: string
  chapterId: string
  nodeId: string
  /** Anchor heading text, or the chapter title for an entry without a heading. */
  title: string
  chapterTitle: string
  /** True for the first route node of a chapter. */
  entry: boolean
}

export interface RuntimeRouteEdge {
  id: string
  source: string
  target: string
}

export interface RuntimeRouteGraph {
  nodes: RuntimeRouteNode[]
  edges: RuntimeRouteEdge[]
}

function key(address: RuntimeAddress) {
  return `${address.chapterId}#${address.nodeId}`
}

function choiceOptions(node: RuntimeNode): RuntimeChoice[] {
  const options = node.data?.options
  return Array.isArray(options) ? options as unknown as RuntimeChoice[] : []
}

/** Static successors, matching `transition.ts`: hidden or targetless choices fall through to `next`. */
function successors(node: RuntimeNode): RuntimeAddress[] {
  if (node.kind === 'end')
    return []
  if (node.kind !== 'choices')
    return node.next ? [node.next] : []
  const options = choiceOptions(node)
  const targets = options.flatMap(option => option.target ? [option.target] : [])
  const fallsThrough = options.length === 0 || options.some(option => !option.target || option.when)
  return fallsThrough && node.next ? [...targets, node.next] : targets
}

/**
 * Chapter entries and anchors of a compiled program, connected when the story
 * can move from one to the next without passing another route node.
 */
export function createRuntimeRouteGraph(program: RuntimeProgram): RuntimeRouteGraph {
  const routeNodes = new Map<string, RuntimeRouteNode>()
  for (const chapter of Object.values(program.chapters)) {
    const chapterTitle = chapter.title ?? chapter.id
    for (const nodeId of chapter.order) {
      const node = chapter.nodes[nodeId]
      const entry = nodeId === chapter.entry
      if (!entry && node.kind !== 'anchor')
        continue
      const text = node.kind === 'anchor' && typeof node.data?.text === 'string' ? node.data.text : undefined
      routeNodes.set(key({ chapterId: chapter.id, nodeId }), {
        id: key({ chapterId: chapter.id, nodeId }),
        chapterId: chapter.id,
        nodeId,
        title: text ?? chapterTitle,
        chapterTitle,
        entry,
      })
    }
  }

  const edges = new Map<string, RuntimeRouteEdge>()
  for (const source of routeNodes.values()) {
    const start = program.chapters[source.chapterId].nodes[source.nodeId]
    const pending = successors(start)
    const seen = new Set<string>([source.id])
    while (pending.length) {
      const address = pending.shift()!
      const id = key(address)
      if (seen.has(id))
        continue
      seen.add(id)
      if (routeNodes.has(id)) {
        const edgeId = `${source.id}->${id}`
        edges.set(edgeId, { id: edgeId, source: source.id, target: id })
        continue
      }
      const node = program.chapters[address.chapterId]?.nodes[address.nodeId]
      if (node)
        pending.push(...successors(node))
    }
  }

  return { nodes: [...routeNodes.values()], edges: [...edges.values()] }
}

/** Only visited route nodes, and edges whose two ends were both visited. */
export function visibleRuntimeRouteGraph(graph: RuntimeRouteGraph, visited: ReadonlySet<string>): RuntimeRouteGraph {
  return {
    nodes: graph.nodes.filter(node => visited.has(node.id)),
    edges: graph.edges.filter(edge => visited.has(edge.source) && visited.has(edge.target)),
  }
}
