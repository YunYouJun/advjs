import type {
  AdvAst,
  AdvProjectDiagnostic,
  RuntimeAddress,
  RuntimeChoice,
  RuntimeExpression,
  RuntimeNode,
} from '@advjs/types'
import type { EditorProjectModel } from '../adapters/browser/project'
import { evaluateRuntimeExpression } from '@advjs/core'
import { parseAst } from '@advjs/parser'

export type ProjectFlowReachability = 'reachable' | 'unreachable' | 'unknown'

export interface ProjectFlowSource {
  readonly path: string
  readonly line: number
  readonly column: number
}

export interface ProjectFlowNode {
  readonly id: string
  readonly kind: 'chapter' | 'story' | 'choice'
  readonly label: string
  readonly chapterId: string
  readonly runtimeKind?: string
  /** Markdown heading depth for presentation-only section grouping. */
  readonly headingDepth?: number
  readonly address?: RuntimeAddress
  readonly source?: ProjectFlowSource
  readonly diagnostics: readonly AdvProjectDiagnostic[]
  /** Possible static routes, not recorded playthrough coverage. */
  readonly reachability: ProjectFlowReachability
  readonly isEntry: boolean
  readonly conditional: boolean
}

export interface ProjectFlowEdge {
  readonly id: string
  readonly source: string
  readonly target: string
  readonly kind: 'chapter-entry' | 'next' | 'choice' | 'jump' | 'fallback'
  readonly label?: string
  readonly conditional: boolean
  readonly crossChapter: boolean
}

export interface ProjectFlowChapter {
  readonly id: string
  readonly title: string
  readonly sourcePaths: readonly string[]
  /** Story and choice node ids; the chapter header is excluded. */
  readonly nodeIds: readonly string[]
  readonly entryNodeId?: string
  readonly reachability: ProjectFlowReachability
}

export interface ProjectFlowGraph {
  readonly status: 'ready' | 'invalid' | 'empty'
  readonly nodes: readonly ProjectFlowNode[]
  readonly edges: readonly ProjectFlowEdge[]
  readonly chapters: readonly ProjectFlowChapter[]
  readonly diagnostics: readonly AdvProjectDiagnostic[]
  readonly entryNodeId?: string
  readonly counts: {
    readonly chapters: number
    readonly storyNodes: number
    readonly choices: number
    /** Reachability counts exclude chapter headers. */
    readonly reachable: number
    readonly unreachable: number
    readonly unknown: number
  }
}

interface SourceRange {
  source: ProjectFlowSource
  end?: ProjectFlowSource
}

interface NodeSource extends SourceRange {
  choices: Array<SourceRange | undefined>
  syntheticTerminal?: boolean
}

type FlowInput = Pick<EditorProjectModel, 'compilation' | 'files'>
type PendingNode = Omit<ProjectFlowNode, 'reachability'>

interface SourceFile {
  path: string
  content: string
  lineCount: number
}

interface SourceCacheEntry {
  sources: readonly SourceFile[]
  locations: Map<string, NodeSource>
}

export interface ProjectFlowBuilderStats {
  /** Chapter source indexes reused since the most recent clear(). */
  readonly sourceHits: number
  /** Chapter source indexes parsed since the most recent clear(). */
  readonly sourceMisses: number
  readonly cachedChapters: number
}

export interface ProjectFlowBuilder {
  buildProjectFlow: (model: FlowInput) => Promise<ProjectFlowGraph>
  clear: () => void
  readonly stats: ProjectFlowBuilderStats
}

export function projectFlowChapterId(chapterId: string): string {
  return `chapter:${encodeURIComponent(chapterId)}`
}

export function projectFlowStoryId(address: RuntimeAddress): string {
  return `story:${encodeURIComponent(address.chapterId)}:${encodeURIComponent(address.nodeId)}`
}

function choiceNodeId(address: RuntimeAddress, choiceId: string): string {
  return `choice:${encodeURIComponent(address.chapterId)}:${encodeURIComponent(address.nodeId)}:${encodeURIComponent(choiceId)}`
}

function hasVariable(expression: RuntimeExpression): boolean {
  if (expression.type === 'variable')
    return true
  if (expression.type === 'unary')
    return hasVariable(expression.argument)
  if (expression.type === 'binary')
    return hasVariable(expression.left) || hasVariable(expression.right)
  return false
}

/** Fold only closed expressions; initial variables can change during play. */
function condition(expression: RuntimeExpression | undefined): boolean | undefined {
  if (!expression)
    return true
  if (hasVariable(expression))
    return undefined
  try {
    return Boolean(evaluateRuntimeExpression(expression, {}))
  }
  catch {
    return undefined
  }
}

function options(node: RuntimeNode): RuntimeChoice[] {
  return node.kind === 'choices' && Array.isArray(node.data?.options)
    ? node.data.options as unknown as RuntimeChoice[]
    : []
}

function storyLabel(node: RuntimeNode): string {
  for (const value of [node.data?.text, node.data?.label]) {
    if (typeof value === 'string' && value.trim())
      return value.trim()
  }
  if (node.kind === 'end')
    return '结束'
  const place = node.data?.place
  if (node.kind === 'scene' && typeof place === 'string')
    return place
  const operationNames: Record<string, string> = {
    background: '背景',
    bgm: '音乐',
    tachie: '立绘',
    cg: 'CG',
    transition: '转场',
  }
  if (node.kind === 'effects' && Array.isArray(node.data?.operations)) {
    const labels = node.data.operations.flatMap((operation) => {
      if (!operation || typeof operation !== 'object' || Array.isArray(operation) || typeof operation.type !== 'string')
        return []
      const name = [operation.name, operation.id, operation.src, operation.url].find(value => typeof value === 'string' && value.trim())
      const kind = operationNames[operation.type] ?? operation.type
      return [name ? `${kind} · ${name}` : kind]
    })
    if (labels.length)
      return labels.join(' / ')
  }
  if (node.kind === 'actions' && node.actions?.length) {
    return node.actions.map((action) => {
      const key = action.args?.key
      return typeof key === 'string' ? `${action.type} · ${key}` : action.type
    }).join(' / ')
  }
  const name = node.data?.name
  if (typeof name === 'string' && name.trim())
    return name.trim()
  const kindNames: Record<string, string> = { choices: '选项', dialog: '对白', narration: '旁白', text: '文本', scene: '场景', effects: '场景操作', actions: '动作', anchor: '锚点' }
  return kindNames[node.kind] ?? `${node.kind} · ${node.id}`
}

function normalizedPath(path: string): string {
  return path.replaceAll('\\', '/').split('/').filter(part => part && part !== '.').join('/')
}

async function chapterSources(sources: readonly SourceFile[]): Promise<Map<string, NodeSource>> {
  const content = sources.map(file => file.content).join('\n\n')
  const locations = new Map<string, NodeSource>()
  if (!sources.length)
    return locations

  let lineOffset = 0
  const offsets = sources.map((file) => {
    const offset = lineOffset
    lineOffset += file.lineCount + 1
    return { offset, endLine: offset + file.lineCount }
  })

  // Mirror compiler concatenation and line remapping. Parsing retrieves locations
  // only: the linked RuntimeProgram remains the authority for nodes and edges.
  const remap = (line: number, column: number): ProjectFlowSource => {
    let low = 0
    let high = sources.length - 1
    while (low < high) {
      const middle = (low + high) >>> 1
      if (line <= offsets[middle].endLine)
        high = middle
      else
        low = middle + 1
    }
    return { path: sources[low].path, line: line - offsets[low].offset, column }
  }
  const range = (node: AdvAst.Node): SourceRange | undefined => {
    if (!node.position)
      return undefined
    return {
      source: remap(node.position.start.line, node.position.start.column),
      end: remap(node.position.end.line, node.position.end.column),
    }
  }

  try {
    const ast = await parseAst(content)
    ast.children.forEach((node, index) => {
      const location = range(node)
      if (!location)
        return
      locations.set(node.id ?? `node-${index}`, {
        ...location,
        choices: node.type === 'choices' ? node.choices.map(range) : [],
      })
    })
    // The compiler's synthetic terminal has no AST node. Locate it at the same
    // final source line instead of guessing an authored ending's position.
    if (!locations.has('end'))
      locations.set('end', { source: remap(lineOffset - 1, 1), choices: [], syntheticTerminal: true })
  }
  catch {
    // Compilation owns syntax errors. The chapter header and diagnostic source
    // remain navigable even when its source cannot be parsed for node positions.
  }
  return locations
}

async function projectFlow(model: FlowInput, locations: Map<string, Map<string, NodeSource>>): Promise<ProjectFlowGraph> {
  const { project, sourceMap } = model.compilation
  const program = project.program
  const diagnostics = [...model.compilation.diagnostics]
  const pendingNodes: PendingNode[] = []
  const edges: ProjectFlowEdge[] = []
  const chapterRows: Omit<ProjectFlowChapter, 'reachability'>[] = []
  const chapterIds = [...new Set([
    ...project.chapters.map(chapter => chapter.id),
    ...Object.keys(program?.chapters ?? {}),
  ])]
  const configuredChapters = new Map(project.chapters.map(chapter => [chapter.id, chapter]))
  const diagnosticsByPath = new Map<string, Array<{ diagnostic: AdvProjectDiagnostic, index: number }>>()
  diagnostics.forEach((diagnostic, index) => {
    if (diagnostic.path) {
      const entries = diagnosticsByPath.get(diagnostic.path) ?? []
      entries.push({ diagnostic, index })
      diagnosticsByPath.set(diagnostic.path, entries)
    }
  })
  const positionedDiagnostics = new Map([...diagnosticsByPath].map(([path, entries]) => [path, entries.filter(entry => entry.diagnostic.line !== undefined).sort((a, b) => a.diagnostic.line! - b.diagnostic.line!)]))
  const sourceDiagnostics = (range: SourceRange | undefined) => {
    if (!range)
      return []
    const entries = positionedDiagnostics.get(range.source.path) ?? []
    let low = 0
    let high = entries.length
    while (low < high) {
      const middle = (low + high) >>> 1
      if (entries[middle].diagnostic.line! < range.source.line)
        low = middle + 1
      else
        high = middle
    }
    const endLine = range.end?.path === range.source.path ? range.end.line : range.source.line
    const matches = []
    for (let index = low; index < entries.length && entries[index].diagnostic.line! <= endLine; index++)
      matches.push(entries[index])
    return matches.sort((a, b) => a.index - b.index).map(entry => entry.diagnostic)
  }

  // The Markdown compiler appends an automatic terminal even after an explicit
  // ending. Keep it only when a displayed runtime route can reference it; an
  // unconditional ending's serialized next is never followed by the runtime.
  const referenced = new Set<string>()
  const reference = (address: RuntimeAddress | undefined) => {
    if (address)
      referenced.add(projectFlowStoryId(address))
  }
  reference(program?.entry)
  for (const [chapterId, chapter] of Object.entries(program?.chapters ?? {})) {
    reference({ chapterId, nodeId: chapter.entry })
    for (const node of Object.values(chapter.nodes)) {
      if (node.kind === 'choices') {
        const choices = options(node)
        for (const choice of choices)
          reference(choice.target ?? node.next)
        if (condition(node.when) !== true || !choices.some(choice => condition(choice.when) === true))
          reference(node.next)
      }
      else if (node.kind !== 'end' || condition(node.when) !== true) {
        reference(node.next)
      }
    }
  }

  for (const chapterId of chapterIds) {
    const configured = configuredChapters.get(chapterId)
    const chapter = program?.chapters[chapterId]
    const sourcePaths = [...sourceMap.chapters[chapterId] ?? configured?.sources ?? []]
    const chapterDiagnostics = [...new Set(sourcePaths)].flatMap(path => diagnosticsByPath.get(path) ?? []).sort((a, b) => a.index - b.index).map(entry => entry.diagnostic)
    const title = chapter?.title ?? configured?.title ?? chapterId
    const nodeIds: string[] = []
    pendingNodes.push({
      id: projectFlowChapterId(chapterId),
      kind: 'chapter',
      label: title,
      chapterId,
      source: sourcePaths[0] ? { path: sourcePaths[0], line: 1, column: 1 } : undefined,
      diagnostics: chapterDiagnostics,
      isEntry: (program?.entry.chapterId ?? project.entryChapterId) === chapterId,
      conditional: false,
    })
    // Include unordered nodes defensively, preserving the canonical runtime order.
    const order = [...new Set([...chapter?.order ?? [], ...Object.keys(chapter?.nodes ?? {})])]
    for (const nodeId of order) {
      const node = chapter?.nodes[nodeId]
      if (!node)
        continue
      const address = { chapterId, nodeId }
      const id = projectFlowStoryId(address)
      const location = locations.get(chapterId)?.get(nodeId)
      if (project.format === 'adv-md' && nodeId === 'end' && node.kind === 'end' && location?.syntheticTerminal && !referenced.has(id))
        continue
      const nodeDiagnostics = sourceDiagnostics(location)
      nodeIds.push(id)
      pendingNodes.push({
        id,
        kind: 'story',
        label: storyLabel(node),
        chapterId,
        runtimeKind: node.kind,
        headingDepth: node.kind === 'anchor' && typeof node.data?.depth === 'number' ? node.data.depth : undefined,
        address,
        source: location?.source,
        diagnostics: nodeDiagnostics,
        isEntry: program?.entry.chapterId === chapterId && program.entry.nodeId === nodeId,
        conditional: Boolean(node.when),
      })
      options(node).forEach((choice, index) => {
        const choiceId = choiceNodeId(address, choice.id)
        const choiceLocation = location?.choices[index]
        nodeIds.push(choiceId)
        pendingNodes.push({
          id: choiceId,
          kind: 'choice',
          label: choice.label,
          chapterId,
          address,
          source: choiceLocation?.source ?? location?.source,
          diagnostics: sourceDiagnostics(choiceLocation),
          isEntry: false,
          conditional: Boolean(node.when || choice.when),
        })
      })
    }
    chapterRows.push({
      id: chapterId,
      title,
      sourcePaths,
      nodeIds,
      entryNodeId: chapter?.nodes[chapter.entry] ? projectFlowStoryId({ chapterId, nodeId: chapter.entry }) : undefined,
    })
  }

  const nodeById = new Map(pendingNodes.map(node => [node.id, node]))
  const successors = new Map<string, Set<string>>()
  const opaque = new Set<string>()
  const addEdge = (source: string, target: string | undefined, kind: ProjectFlowEdge['kind'], conditional = false, label?: string, enabled = true) => {
    if (!target)
      return
    const from = nodeById.get(source)
    const to = nodeById.get(target)
    if (!from || !to) {
      diagnostics.push({
        code: 'ADV_EDITOR_FLOW_UNKNOWN_TARGET',
        severity: 'error',
        message: `The compiled flow references a missing node: ${target}`,
        path: from?.source?.path,
        line: from?.source?.line,
        column: from?.source?.column,
      })
      return
    }
    edges.push({ id: `${kind}:${source}->${target}`, source, target, kind, conditional, label, crossChapter: from.chapterId !== to.chapterId })
    if (enabled && kind !== 'chapter-entry') {
      const destinations = successors.get(source) ?? new Set<string>()
      destinations.add(target)
      successors.set(source, destinations)
    }
  }
  const targetId = (target: RuntimeAddress | undefined) => target ? projectFlowStoryId(target) : undefined
  for (const chapter of chapterRows)
    addEdge(projectFlowChapterId(chapter.id), chapter.entryNodeId, 'chapter-entry')
  for (const [chapterId, chapter] of Object.entries(program?.chapters ?? {})) {
    for (const node of Object.values(chapter.nodes)) {
      const address = { chapterId, nodeId: node.id }
      const id = projectFlowStoryId(address)
      const enabled = condition(node.when)
      const choices = options(node)
      const hasHostActions = node.actions?.some(action => !action.type.startsWith('variables/'))
        || choices.some(choice => condition(choice.when) !== false && choice.actions?.some(action => !action.type.startsWith('variables/')))
      if (enabled !== false && (node.kind.includes('/') || node.kind === '$dynamic' || hasHostActions))
        opaque.add(id)

      if (node.kind === 'choices') {
        for (const choice of choices) {
          const choiceId = choiceNodeId(address, choice.id)
          const choiceEnabled = enabled !== false && condition(choice.when) !== false
          addEdge(id, choiceId, 'choice', Boolean(node.when || choice.when), undefined, choiceEnabled)
          const target = choice.target ?? node.next
          addEdge(choiceId, targetId(target), choice.target ? 'jump' : 'next', Boolean(node.when || choice.when), undefined, choiceEnabled)
        }
        // Runtime skips a conditional node or a group with no visible options.
        if (enabled !== true || !choices.some(choice => condition(choice.when) === true))
          addEdge(id, targetId(node.next), 'fallback', Boolean(node.when || choices.some(choice => choice.when)))
      }
      else if (node.kind !== 'end' || enabled !== true) {
        addEdge(id, targetId(node.next), node.next?.chapterId !== chapterId ? 'jump' : 'next', Boolean(node.when))
      }
    }
  }

  const requestedEntry = program ? targetId(program.entry) : undefined
  const entryNodeId = requestedEntry && nodeById.has(requestedEntry) ? requestedEntry : undefined
  if (requestedEntry && !entryNodeId) {
    diagnostics.push({ code: 'ADV_EDITOR_FLOW_UNKNOWN_ENTRY', severity: 'error', message: `The compiled flow entry does not exist: ${requestedEntry}` })
  }
  const reachable = new Set<string>()
  const queue = entryNodeId ? [entryNodeId] : []
  while (queue.length) {
    const id = queue.pop()!
    if (reachable.has(id))
      continue
    reachable.add(id)
    for (const destination of successors.get(id) ?? [])
      queue.push(destination)
  }
  const uncertainNavigation = [...opaque].some(id => reachable.has(id))
  const reachability = (id: string): ProjectFlowReachability => reachable.has(id)
    ? 'reachable'
    : !entryNodeId || uncertainNavigation ? 'unknown' : 'unreachable'
  const chapters = chapterRows.map((chapter): ProjectFlowChapter => ({
    ...chapter,
    reachability: chapter.nodeIds.some(id => reachable.has(id))
      ? 'reachable'
      : !entryNodeId || uncertainNavigation ? 'unknown' : 'unreachable',
  }))
  const chapterById = new Map(chapters.map(chapter => [chapter.id, chapter]))
  const addedDiagnostics = new Map<string | undefined, Map<number | undefined, AdvProjectDiagnostic[]>>()
  for (const diagnostic of diagnostics.slice(model.compilation.diagnostics.length)) {
    const byLine = addedDiagnostics.get(diagnostic.path) ?? new Map<number | undefined, AdvProjectDiagnostic[]>()
    const entries = byLine.get(diagnostic.line) ?? []
    entries.push(diagnostic)
    byLine.set(diagnostic.line, entries)
    addedDiagnostics.set(diagnostic.path, byLine)
  }
  const nodes = pendingNodes.map((node): ProjectFlowNode => ({
    ...node,
    diagnostics: [...node.diagnostics, ...addedDiagnostics.get(node.source?.path)?.get(node.source?.line) ?? []],
    reachability: node.kind === 'chapter'
      ? chapterById.get(node.chapterId)!.reachability
      : reachability(node.id),
  }))
  const storyNodes = nodes.filter(node => node.kind !== 'chapter')
  return {
    status: diagnostics.some(diagnostic => diagnostic.severity === 'error') || (!program && chapterIds.length) ? 'invalid' : program ? 'ready' : 'empty',
    nodes,
    edges,
    chapters,
    diagnostics,
    entryNodeId,
    counts: {
      chapters: chapters.length,
      storyNodes: storyNodes.filter(node => node.kind === 'story').length,
      choices: storyNodes.filter(node => node.kind === 'choice').length,
      reachable: storyNodes.filter(node => node.reachability === 'reachable').length,
      unreachable: storyNodes.filter(node => node.reachability === 'unreachable').length,
      unknown: storyNodes.filter(node => node.reachability === 'unknown').length,
    },
  }
}

/**
 * Own this builder for one workspace and clear it when that workspace changes.
 * Only Markdown source positions are cached: the current compilation always
 * supplies topology, diagnostic annotations and static reachability.
 */
export function createProjectFlowBuilder(): ProjectFlowBuilder {
  let cache = new Map<string, SourceCacheEntry>()
  let revision = 0
  let sourceHits = 0
  let sourceMisses = 0
  return {
    async buildProjectFlow(model) {
      const request = ++revision
      const { project, sourceMap } = model.compilation
      const configured = new Map(project.chapters.map(chapter => [chapter.id, chapter]))
      const chapterIds = [...new Set([...configured.keys(), ...Object.keys(project.program?.chapters ?? {})])]
      const files = new Map(Object.entries(model.files).map(([path, content]) => [normalizedPath(path), {
        content,
        lineCount: content.split('\n').length,
      }]))
      const nextCache = new Map<string, SourceCacheEntry>()
      const locations = new Map(await Promise.all(chapterIds.map(async (chapterId) => {
        const paths = sourceMap.chapters[chapterId] ?? configured.get(chapterId)?.sources ?? []
        const sources = paths.map((path): SourceFile => ({ path, ...files.get(normalizedPath(path)) ?? { content: '', lineCount: 1 } }))
        const existing = cache.get(chapterId)
        let entry: SourceCacheEntry
        if (existing && existing.sources.length === sources.length && existing.sources.every((file, index) => file.path === sources[index].path && file.content === sources[index].content)) {
          sourceHits++
          entry = existing
        }
        else {
          sourceMisses++
          entry = { sources, locations: await chapterSources(sources) }
        }
        nextCache.set(chapterId, entry)
        return [chapterId, entry.locations] as const
      })))
      // A clear() or newer request can run while Markdown parsing is pending.
      // Its cache must never be overwritten by this obsolete result.
      if (request === revision)
        cache = nextCache
      return projectFlow(model, locations)
    },
    clear() {
      revision++
      cache.clear()
      sourceHits = 0
      sourceMisses = 0
    },
    get stats() {
      return { sourceHits, sourceMisses, cachedChapters: cache.size }
    },
  }
}

/** Stateless compatibility projection without retaining workspace content. */
export function buildProjectFlow(model: FlowInput): Promise<ProjectFlowGraph> {
  return createProjectFlowBuilder().buildProjectFlow(model)
}
