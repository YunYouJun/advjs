import type { AdvAst } from '@advjs/types'

/**
 * A node in the branch graph.
 *
 * - `start` — virtual entry point (always one)
 * - `scene` — a `【...】` scene block, addressable by `go target` and choice targets
 * - `choices` — a fork point
 * - `option` — one selectable option under a choices node
 * - `dead` — a choice with no resolvable target and no fall-through node
 * - `end` — terminal node (one per script)
 */
export type BranchNodeKind = 'start' | 'scene' | 'choices' | 'option' | 'dead' | 'end'

export interface BranchNode {
  id: string
  kind: BranchNodeKind
  label: string
  /** Index into ast.children (omitted for synthetic nodes). */
  astIndex?: number
}

export interface BranchEdge {
  from: string
  to: string
  /** When the edge represents a labelled jump (option / go target). */
  label?: string
}

export interface BranchGraph {
  nodes: BranchNode[]
  edges: BranchEdge[]
  /** Number of choice options that lead to `dead` nodes. */
  deadOptions: number
  /** Number of unique scene labels referenced. */
  sceneCount: number
}

const TRUNCATE = 32

function truncate(text: string, max = TRUNCATE): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= max)
    return collapsed
  return `${collapsed.slice(0, max - 1)}…`
}

/**
 * Mermaid-safe quoting: wrap label in `"..."` after escaping inner quotes.
 */
function quoteLabel(label: string): string {
  return `"${label.replace(/"/g, '\\"')}"`
}

/**
 * Find the closest scene-anchored node ID at or before a given AST index,
 * walking left until we hit a scene (or fall off the start of children).
 */
function findEnclosingSceneId(ast: AdvAst.Root, sceneIdsByIndex: Map<number, string>, index: number): string | undefined {
  for (let i = index; i >= 0; i--) {
    const id = sceneIdsByIndex.get(i)
    if (id)
      return id
  }
  void ast
  return undefined
}

/**
 * Walk the AST starting at `fromIndex` and return the first scene/choices
 * node index, or null if the walk falls off the end (the choice runs into
 * the script terminator).
 */
function findNextAnchorIndex(ast: AdvAst.Root, fromIndex: number): { kind: 'scene' | 'choices' | 'end', index: number } {
  for (let i = fromIndex; i < ast.children.length; i++) {
    const node = ast.children[i]
    if (!node)
      continue
    if (node.type === 'scene')
      return { kind: 'scene', index: i }
    if (node.type === 'choices')
      return { kind: 'choices', index: i }
  }
  return { kind: 'end', index: ast.children.length }
}

/**
 * Build a directed branch graph from a parsed adv AST.
 */
export function analyzeBranches(ast: AdvAst.Root): BranchGraph {
  const nodes: BranchNode[] = []
  const edges: BranchEdge[] = []
  const sceneIdsByIndex = new Map<number, string>()

  const startId = 'start'
  const endId = 'end'
  nodes.push({ id: startId, kind: 'start', label: 'START' })

  for (const [place, index] of Object.entries(ast.scene)) {
    const id = `scene_${index}`
    sceneIdsByIndex.set(index, id)
    nodes.push({ id, kind: 'scene', label: place, astIndex: index })
  }

  const choicesIdsByIndex = new Map<number, string>()
  for (let i = 0; i < ast.children.length; i++) {
    const node = ast.children[i]
    if (node?.type === 'choices') {
      const id = `choices_${i}`
      choicesIdsByIndex.set(i, id)
      const label = `Choice (${(node as AdvAst.Choices).choices.length} options)`
      nodes.push({ id, kind: 'choices', label, astIndex: i })
    }
  }

  const linkToNextAnchor = (fromId: string, fromIndex: number, edgeLabel?: string) => {
    const next = findNextAnchorIndex(ast, fromIndex)
    if (next.kind === 'end') {
      ensureEnd()
      edges.push({ from: fromId, to: endId, label: edgeLabel })
    }
    else {
      const id = next.kind === 'scene' ? sceneIdsByIndex.get(next.index)! : choicesIdsByIndex.get(next.index)!
      edges.push({ from: fromId, to: id, label: edgeLabel })
    }
  }

  let endNodeAdded = false
  function ensureEnd() {
    if (!endNodeAdded) {
      nodes.push({ id: endId, kind: 'end', label: 'END' })
      endNodeAdded = true
    }
  }

  linkToNextAnchor(startId, 0)

  for (const [indexStr, id] of Array.from(sceneIdsByIndex.entries()).sort((a, b) => a[0] - b[0]).map(([k, v]) => [String(k), v] as const)) {
    const index = Number(indexStr)
    linkToNextAnchor(id, index + 1)
  }

  let deadOptions = 0
  for (const [index, choicesId] of choicesIdsByIndex) {
    const node = ast.children[index] as AdvAst.Choices
    node.choices.forEach((choice, i) => {
      const optionId = `${choicesId}_opt${i + 1}`
      const optLabel = truncate(choice.text || `Option ${i + 1}`)
      nodes.push({ id: optionId, kind: 'option', label: optLabel })
      edges.push({ from: choicesId, to: optionId })

      if (choice.target && ast.scene[choice.target] !== undefined) {
        const targetIndex = ast.scene[choice.target]
        const targetId = sceneIdsByIndex.get(targetIndex)
        if (targetId) {
          edges.push({ from: optionId, to: targetId, label: `→ ${choice.target}` })
          return
        }
      }

      const next = findNextAnchorIndex(ast, index + 1)
      if (next.kind === 'end') {
        const enclosing = findEnclosingSceneId(ast, sceneIdsByIndex, index)
        if (enclosing) {
          edges.push({ from: optionId, to: endId, label: 'fall-through' })
          ensureEnd()
        }
        else {
          const deadId = `${optionId}_dead`
          nodes.push({ id: deadId, kind: 'dead', label: 'DEAD' })
          edges.push({ from: optionId, to: deadId })
          deadOptions++
        }
      }
      else if (next.kind === 'scene') {
        edges.push({ from: optionId, to: sceneIdsByIndex.get(next.index)! })
      }
      else {
        edges.push({ from: optionId, to: choicesIdsByIndex.get(next.index)! })
      }
    })
  }

  return {
    nodes,
    edges,
    deadOptions,
    sceneCount: sceneIdsByIndex.size,
  }
}

/**
 * Render the graph as a Mermaid flowchart definition.
 */
export function formatMermaid(graph: BranchGraph): string {
  const lines: string[] = ['flowchart TD']
  for (const node of graph.nodes) {
    const label = quoteLabel(node.label)
    switch (node.kind) {
      case 'start':
      case 'end':
        lines.push(`  ${node.id}([${label}])`)
        break
      case 'scene':
        lines.push(`  ${node.id}[${label}]`)
        break
      case 'choices':
        lines.push(`  ${node.id}{${label}}`)
        break
      case 'option':
        lines.push(`  ${node.id}([${label}])`)
        break
      case 'dead':
        lines.push(`  ${node.id}[${label}]:::dead`)
        break
    }
  }
  for (const edge of graph.edges) {
    if (edge.label)
      lines.push(`  ${edge.from} -- ${quoteLabel(edge.label)} --> ${edge.to}`)
    else
      lines.push(`  ${edge.from} --> ${edge.to}`)
  }
  if (graph.deadOptions > 0)
    lines.push('  classDef dead fill:#fee,stroke:#c33;')
  return lines.join('\n')
}

/**
 * Render the graph as JSON (for tooling / MCP consumption).
 */
export function formatJson(graph: BranchGraph): string {
  return JSON.stringify(graph, null, 2)
}

/**
 * Render the graph as a plain-text outline (for terminals without Mermaid
 * rendering).
 */
export function formatText(graph: BranchGraph): string {
  const lines: string[] = []
  const adjacency = new Map<string, BranchEdge[]>()
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from))
      adjacency.set(edge.from, [])
    adjacency.get(edge.from)!.push(edge)
  }
  const visited = new Set<string>()
  const walk = (id: string, depth: number) => {
    const node = graph.nodes.find(n => n.id === id)
    if (!node)
      return
    const indent = '  '.repeat(depth)
    const tag = node.kind === 'start'
      ? '●'
      : node.kind === 'end'
        ? '◉'
        : node.kind === 'choices'
          ? '◇'
          : node.kind === 'option'
            ? '○'
            : node.kind === 'dead' ? '✗' : '□'
    lines.push(`${indent}${tag} ${node.label}`)
    if (visited.has(id))
      return
    visited.add(id)
    for (const edge of adjacency.get(id) ?? []) {
      const labelHint = edge.label ? ` (${edge.label})` : ''
      const childIndent = '  '.repeat(depth + 1)
      walk(edge.to, depth + 1)
      const last = lines.length - 1
      if (labelHint && lines[last].startsWith(childIndent))
        lines[last] += labelHint
    }
  }
  walk('start', 0)
  if (graph.deadOptions > 0)
    lines.push('', `(${graph.deadOptions} dead path(s) detected)`)
  return lines.join('\n')
}
