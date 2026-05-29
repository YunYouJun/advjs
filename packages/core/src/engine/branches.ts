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

  // Build a scene node for EVERY scene occurrence in the AST — not from
  // `ast.scene`, which is keyed by place name and so collapses repeated
  // headers (e.g. two 【学校】 blocks). Keying by AST index keeps every
  // occurrence distinct and guarantees `findNextAnchorIndex` always resolves
  // to an existing node id (otherwise edges dangle with no `to`).
  for (let i = 0; i < ast.children.length; i++) {
    const node = ast.children[i]
    if (node?.type === 'scene') {
      const id = `scene_${i}`
      sceneIdsByIndex.set(i, id)
      nodes.push({ id, kind: 'scene', label: (node as AdvAst.SceneInfo).place, astIndex: i })
    }
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
 * Static coverage analysis derived purely from the branch graph.
 *
 * Unlike a `play`-driven traversal, this never executes the script — it walks
 * the directed graph produced by {@link analyzeBranches}. That makes it fast
 * and deterministic, at the cost of not knowing runtime-only facts (e.g. a
 * `go` target computed from a variable).
 */
export interface CoverageReport {
  /** Total scene anchors declared in the script. */
  totalScenes: number
  /** Scene anchors reachable by following edges from `start`. */
  reachableScenes: number
  /** Labels of scenes that exist but can never be reached from `start`. */
  orphanScenes: string[]
  /** Number of `choices` fork nodes. */
  choicePoints: number
  /** Number of selectable options across all fork nodes. */
  totalOptions: number
  /** Options that dead-end (no resolvable next node). */
  deadOptions: number
  /** Distinct terminal nodes (END + dead ends) reachable from `start`. */
  endings: number
  /** Count of distinct acyclic paths from `start` to a terminal. */
  distinctPaths: number
  /** True when path enumeration hit {@link MAX_ENUMERATED_PATHS}. */
  pathsTruncated: boolean
  /** Node ids unreachable from `start` (orphan scenes plus their subgraphs). */
  unreachableNodes: string[]
}

/** Safety cap on path enumeration — branchy scripts can be exponential. */
export const MAX_ENUMERATED_PATHS = 5000

function buildAdjacency(graph: BranchGraph): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.from))
      adjacency.set(edge.from, [])
    adjacency.get(edge.from)!.push(edge.to)
  }
  return adjacency
}

/**
 * Compute reachability + path-coverage metrics for a branch graph.
 */
export function analyzeCoverage(graph: BranchGraph): CoverageReport {
  const adjacency = buildAdjacency(graph)

  // 1. Reachability — BFS from the synthetic start node.
  const reachable = new Set<string>()
  const queue: string[] = ['start']
  while (queue.length) {
    const id = queue.shift()!
    if (reachable.has(id))
      continue
    reachable.add(id)
    for (const next of adjacency.get(id) ?? [])
      queue.push(next)
  }

  // 2. Terminals = nodes with no outgoing edges (END + dead ends).
  const terminals = graph.nodes.filter(n => !(adjacency.get(n.id)?.length))
  const reachableTerminals = terminals.filter(n => reachable.has(n.id))

  // 3. Path enumeration — DFS pruning cycles (don't revisit a node already on
  //    the current path). Counts distinct acyclic start→terminal walks.
  let distinctPaths = 0
  let pathsTruncated = false
  const onPath = new Set<string>()
  const dfs = (id: string) => {
    if (pathsTruncated)
      return
    const outgoing = adjacency.get(id) ?? []
    if (outgoing.length === 0) {
      distinctPaths++
      if (distinctPaths >= MAX_ENUMERATED_PATHS)
        pathsTruncated = true
      return
    }
    onPath.add(id)
    for (const next of outgoing) {
      if (onPath.has(next))
        continue // prune cycle
      dfs(next)
    }
    onPath.delete(id)
  }
  dfs('start')

  // 4. Scene-level metrics.
  const sceneNodes = graph.nodes.filter(n => n.kind === 'scene')
  const orphanScenes = sceneNodes.filter(n => !reachable.has(n.id)).map(n => n.label)
  const unreachableNodes = graph.nodes.filter(n => !reachable.has(n.id)).map(n => n.id)

  return {
    totalScenes: sceneNodes.length,
    reachableScenes: sceneNodes.length - orphanScenes.length,
    orphanScenes,
    choicePoints: graph.nodes.filter(n => n.kind === 'choices').length,
    totalOptions: graph.nodes.filter(n => n.kind === 'option').length,
    deadOptions: graph.deadOptions,
    endings: reachableTerminals.length,
    distinctPaths,
    pathsTruncated,
    unreachableNodes,
  }
}

/** A coverage report paired with the chapter it came from. */
export interface NamedCoverage {
  name: string
  report: CoverageReport
}

export interface ProjectCoverage {
  chapters: NamedCoverage[]
  totals: {
    chapters: number
    scenes: number
    reachableScenes: number
    choicePoints: number
    options: number
    deadOptions: number
    distinctPaths: number
    orphanScenes: number
    /** Chapters with at least one orphan scene or dead option. */
    chaptersWithIssues: number
  }
}

/**
 * Aggregate per-chapter coverage reports into a project-wide summary.
 *
 * Pure: takes already-computed reports so it can be reused browser-side
 * (Studio) without any filesystem access.
 */
export function aggregateCoverage(chapters: NamedCoverage[]): ProjectCoverage {
  const totals = {
    chapters: chapters.length,
    scenes: 0,
    reachableScenes: 0,
    choicePoints: 0,
    options: 0,
    deadOptions: 0,
    distinctPaths: 0,
    orphanScenes: 0,
    chaptersWithIssues: 0,
  }
  for (const { report } of chapters) {
    totals.scenes += report.totalScenes
    totals.reachableScenes += report.reachableScenes
    totals.choicePoints += report.choicePoints
    totals.options += report.totalOptions
    totals.deadOptions += report.deadOptions
    totals.distinctPaths += report.distinctPaths
    totals.orphanScenes += report.orphanScenes.length
    if (report.orphanScenes.length > 0 || report.deadOptions > 0)
      totals.chaptersWithIssues++
  }
  return { chapters, totals }
}

/**
 * Render a project-wide coverage report as a Markdown table + totals.
 */
export function formatProjectCoverageText(project: ProjectCoverage): string {
  const lines: string[] = []
  lines.push('# Project Branch Coverage')
  lines.push('')

  if (project.chapters.length === 0) {
    lines.push('No chapters found.')
    return lines.join('\n')
  }

  lines.push('| Chapter | Scenes | Choices | Options | Paths | Dead | Orphan |')
  lines.push('|---------|--------|---------|---------|-------|------|--------|')
  for (const { name, report } of project.chapters) {
    const sceneCell = `${report.reachableScenes}/${report.totalScenes}`
    const paths = `${report.distinctPaths}${report.pathsTruncated ? '+' : ''}`
    lines.push(
      `| ${name} | ${sceneCell} | ${report.choicePoints} | ${report.totalOptions} | ${paths} | ${report.deadOptions} | ${report.orphanScenes.length} |`,
    )
  }

  const t = project.totals
  lines.push(`| **Total** | ${t.reachableScenes}/${t.scenes} | ${t.choicePoints} | ${t.options} | ${t.distinctPaths} | ${t.deadOptions} | ${t.orphanScenes} |`)

  lines.push('')
  if (t.chaptersWithIssues === 0) {
    lines.push(`✓ ${t.chapters} chapter(s) clean — no orphan scenes or dead paths.`)
  }
  else {
    lines.push(`⚠ ${t.chaptersWithIssues}/${t.chapters} chapter(s) have orphan scenes or dead paths:`)
    for (const { name, report } of project.chapters) {
      if (report.orphanScenes.length === 0 && report.deadOptions === 0)
        continue
      const parts: string[] = []
      if (report.deadOptions > 0)
        parts.push(`${report.deadOptions} dead`)
      if (report.orphanScenes.length > 0)
        parts.push(`orphans: ${report.orphanScenes.join(', ')}`)
      lines.push(`  - ${name}: ${parts.join('; ')}`)
    }
  }

  return lines.join('\n')
}

/**
 * Render a coverage report as a human-readable text summary.
 */
export function formatCoverageText(report: CoverageReport): string {
  const lines: string[] = []
  lines.push('# Branch Coverage')
  lines.push('')
  const scenePct = report.totalScenes > 0
    ? Math.round((report.reachableScenes / report.totalScenes) * 100)
    : 100
  lines.push(`Scenes reachable : ${report.reachableScenes}/${report.totalScenes} (${scenePct}%)`)
  lines.push(`Choice points    : ${report.choicePoints}`)
  lines.push(`Options          : ${report.totalOptions}`)
  lines.push(`Endings reachable: ${report.endings}`)
  lines.push(`Distinct paths   : ${report.distinctPaths}${report.pathsTruncated ? '+ (truncated)' : ''}`)
  lines.push(`Dead options     : ${report.deadOptions}`)

  if (report.orphanScenes.length) {
    lines.push('')
    lines.push('⚠ Orphan scenes (unreachable from start):')
    for (const label of report.orphanScenes)
      lines.push(`  - ${label}`)
  }

  if (report.deadOptions > 0) {
    lines.push('')
    lines.push(`✗ ${report.deadOptions} dead option(s) — choices with no resolvable next node.`)
  }

  if (!report.orphanScenes.length && report.deadOptions === 0) {
    lines.push('')
    lines.push('✓ No orphan scenes or dead paths detected.')
  }

  return lines.join('\n')
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
