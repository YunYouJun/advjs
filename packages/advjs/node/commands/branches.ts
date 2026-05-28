import type { AdvAst } from '@advjs/types'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { analyzeBranches, formatJson, formatMermaid, formatText } from '@advjs/core'
import { parseAst } from '@advjs/parser'

// Pure graph + formatter logic lives in @advjs/core so the browser-side Studio
// can reuse it. This file only adds the CLI file-IO wrapper.
export type { BranchEdge, BranchGraph, BranchNode, BranchNodeKind } from '@advjs/core'
export { analyzeBranches, formatJson, formatMermaid, formatText } from '@advjs/core'

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
