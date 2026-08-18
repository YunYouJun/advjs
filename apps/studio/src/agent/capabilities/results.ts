import type { AgentCapabilityId } from '../core/contracts'

export interface ManagedPlotSuggestion {
  label: string
  synopsis: string
  hook: string
}

export interface ManagedRoleplayLine {
  speakerId: string
  speakerName: string
  content: string
}

export type ManagedCapabilityResult
  = | { kind: 'plot-suggestions', suggestions: readonly ManagedPlotSuggestion[] }
    | { kind: 'roleplay-lines', lines: readonly ManagedRoleplayLine[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Parses only the public, server-validated non-patch results used by the task rail. */
export function parseManagedCapabilityResult(
  capability: AgentCapabilityId,
  streamText: string,
): ManagedCapabilityResult | undefined {
  if (!streamText || (capability !== 'suggest-plot' && capability !== 'simulate-roleplay'))
    return undefined
  let root: unknown
  try {
    root = JSON.parse(streamText)
  }
  catch {
    return undefined
  }
  if (!isRecord(root))
    return undefined

  if (capability === 'suggest-plot') {
    if (!Array.isArray(root.suggestions))
      return undefined
    const suggestions = root.suggestions.flatMap((value) => {
      if (!isRecord(value))
        return []
      const label = text(value.label)
      const synopsis = text(value.synopsis)
      const hook = text(value.hook)
      return label && synopsis && hook ? [{ label, synopsis, hook }] : []
    })
    return suggestions.length ? { kind: 'plot-suggestions', suggestions } : undefined
  }

  if (!Array.isArray(root.lines))
    return undefined
  const lines = root.lines.flatMap((value) => {
    if (!isRecord(value))
      return []
    const speakerId = text(value.speakerId)
    const speakerName = text(value.speakerName)
    const content = text(value.content)
    return speakerId && speakerName && content ? [{ speakerId, speakerName, content }] : []
  })
  return lines.length ? { kind: 'roleplay-lines', lines } : undefined
}
