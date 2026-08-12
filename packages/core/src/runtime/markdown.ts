import type {
  CompileDiagnostic,
  MarkdownProgramSource,
} from '../compiler'
import type { AdvRuntime, AdvRuntimeOptions } from './create'
import type {
  RuntimePluginDiagnostic,
} from './registry'
import { compileMarkdownProgram } from '../compiler'
import { createAdvRuntime } from './create'
import { validateRuntimeProgramPlugins } from './registry'

export type AdvMarkdownRuntimeDiagnostic = CompileDiagnostic | RuntimePluginDiagnostic

export type AdvMarkdownRuntimeOptions = MarkdownProgramSource & Omit<AdvRuntimeOptions, 'program'>

export interface AdvMarkdownRuntimeResult {
  runtime: AdvRuntime
  diagnostics: CompileDiagnostic[]
}

export class AdvMarkdownRuntimeError extends Error {
  readonly code = 'ADV_MARKDOWN_RUNTIME_INVALID'
  readonly diagnostics: readonly AdvMarkdownRuntimeDiagnostic[]

  constructor(diagnostics: readonly AdvMarkdownRuntimeDiagnostic[]) {
    const first = diagnostics[0]
    const suffix = diagnostics.length > 1 ? ` (+${diagnostics.length - 1} more)` : ''
    super(first ? `${first.code}: ${first.message}${suffix}` : 'Unable to create Markdown runtime')
    this.name = 'AdvMarkdownRuntimeError'
    this.diagnostics = structuredClone(diagnostics)
  }
}

/**
 * Compile Markdown chapters, validate plugin capabilities, and create one
 * runtime through a single interface. The returned runtime remains idle so a
 * host can subscribe before calling `start()`.
 */
export async function createAdvMarkdownRuntime(
  options: AdvMarkdownRuntimeOptions,
): Promise<AdvMarkdownRuntimeResult> {
  const {
    id,
    chapters,
    requiredPlugins,
    resources,
    initialVariables,
    maxCheckpoints,
    maxTraceEntries,
    now,
    plugins,
  } = options
  const compiled = await compileMarkdownProgram({
    id,
    chapters,
    requiredPlugins,
    resources,
  })

  if (!compiled.program)
    throw new AdvMarkdownRuntimeError(compiled.diagnostics)

  const pluginDiagnostics = validateRuntimeProgramPlugins(compiled.program, plugins)
  if (pluginDiagnostics.length > 0)
    throw new AdvMarkdownRuntimeError(pluginDiagnostics)

  const runtimeOptions: AdvRuntimeOptions = {
    program: compiled.program,
    ...(initialVariables ? { initialVariables } : {}),
    ...(maxCheckpoints === undefined ? {} : { maxCheckpoints }),
    ...(maxTraceEntries === undefined ? {} : { maxTraceEntries }),
    ...(now ? { now } : {}),
    ...(plugins ? { plugins } : {}),
  }

  return {
    runtime: createAdvRuntime(runtimeOptions),
    diagnostics: structuredClone(compiled.diagnostics),
  }
}
