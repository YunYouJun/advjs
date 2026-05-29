import type { NamedCoverage } from '@advjs/core'
import type { AdvAst } from '@advjs/types'
import { readFileSync } from 'node:fs'
import { basename, relative } from 'node:path'
import process from 'node:process'
import { aggregateCoverage, analyzeBranches, analyzeCoverage, formatCoverageText, formatJson, formatMermaid, formatProjectCoverageText, formatText } from '@advjs/core'
import { parseAst } from '@advjs/parser'
import { resolveGameRoot, scanFiles } from './utils'

// Pure graph + formatter logic lives in @advjs/core so the browser-side Studio
// can reuse it. This file only adds the CLI file-IO wrapper.
export type { BranchEdge, BranchGraph, BranchNode, BranchNodeKind, CoverageReport, NamedCoverage, ProjectCoverage } from '@advjs/core'
export { aggregateCoverage, analyzeBranches, analyzeCoverage, formatCoverageText, formatJson, formatMermaid, formatProjectCoverageText, formatText } from '@advjs/core'

export interface BranchAnalyzeOptions {
  scriptPath: string
  format: 'mermaid' | 'json' | 'text'
}

/**
 * Top-level entry: parse a script file and emit the requested format.
 */
export async function analyzeBranchesFromFile(options: BranchAnalyzeOptions): Promise<string> {
  const content = readFileSync(options.scriptPath, 'utf-8')
  const ast = await parseAst(content) as AdvAst.Root
  const graph = analyzeBranches(ast)
  switch (options.format) {
    case 'mermaid':
      return formatMermaid(graph)
    case 'json':
      return formatJson({
        // Hint at provenance in JSON so downstream tools can label it
        ...graph,
        // @ts-expect-error — extra metadata field for tooling
        scriptName: basename(options.scriptPath),
      })
    case 'text':
      return formatText(graph)
  }
}

export interface CoverageAnalyzeOptions {
  scriptPath: string
  format: 'text' | 'json'
}

/**
 * Parse a script file, build its branch graph, and emit a coverage report.
 */
export async function analyzeCoverageFromFile(options: CoverageAnalyzeOptions): Promise<string> {
  const content = readFileSync(options.scriptPath, 'utf-8')
  const ast = await parseAst(content) as AdvAst.Root
  const graph = analyzeBranches(ast)
  const report = analyzeCoverage(graph)
  if (options.format === 'json') {
    return JSON.stringify({ ...report, scriptName: basename(options.scriptPath) }, null, 2)
  }
  return formatCoverageText(report)
}

export interface ProjectCoverageOptions {
  /** Game content root override; falls back to adv.config.json / ./adv. */
  root?: string
  cwd?: string
  format: 'text' | 'json'
}

/**
 * Scan every chapter under the game root, run coverage on each, and emit an
 * aggregate project-wide report. Used by `adv debug coverage` with no script
 * argument — the natural input for the adv-debug "generate coverage report"
 * workflow.
 */
export async function analyzeProjectCoverage(options: ProjectCoverageOptions): Promise<string> {
  const cwd = options.cwd || process.cwd()
  const gameRoot = resolveGameRoot(cwd, options.root)
  const chaptersDir = `${gameRoot}/chapters`

  // Chapters live under chapters/; also pick up root-level .adv.md (mirrors check).
  const files = [...scanFiles(chaptersDir, '.adv.md'), ...scanFiles(gameRoot, '.adv.md')]
  // De-dupe (a root-level file could match both scans) and sort for stable output.
  const unique = Array.from(new Set(files)).sort()

  const chapters: NamedCoverage[] = []
  for (const file of unique) {
    const content = readFileSync(file, 'utf-8')
    const ast = await parseAst(content) as AdvAst.Root
    const report = analyzeCoverage(analyzeBranches(ast))
    chapters.push({ name: relative(gameRoot, file), report })
  }

  const project = aggregateCoverage(chapters)
  if (options.format === 'json')
    return JSON.stringify(project, null, 2)
  return formatProjectCoverageText(project)
}
