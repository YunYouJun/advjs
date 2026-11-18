import type { CreativeArtifact } from './contracts'

/** Author-only input. The target is derived from the immutable legacy candidate. */
export interface CreativeTextEditOutput { kind: 'source-text', summary: string, content: string }

/** The two legacy generators produce exactly one source patch; advice and media remain read-only. */
export function creativeTextEditOutput(artifact: CreativeArtifact, capability: string | undefined): CreativeTextEditOutput | undefined {
  if (artifact.output || artifact.media || artifact.legacyResult || artifact.changes.length !== 1)
    return undefined
  const change = artifact.changes[0]!
  if (typeof change.after !== 'string'
    || !((capability === 'generate-outline' && artifact.kind === 'outline' && change.path === 'adv/outline.md')
      || (capability === 'generate-chapter-draft' && artifact.kind === 'chapter' && /^adv\/chapters\/[\w.-]+\.adv\.md$/.test(change.path)))) {
    return undefined
  }
  return { kind: 'source-text', summary: artifact.summary, content: change.after }
}

export function parseCreativeTextEditOutput(value: unknown): CreativeTextEditOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['kind', 'summary', 'content'].includes(key)))
    throw new TypeError('Invalid author source text authority')
  const input = value as Record<string, unknown>
  if (input.kind !== 'source-text' || typeof input.summary !== 'string' || !input.summary.trim() || input.summary.length > 1000
    || typeof input.content !== 'string' || new TextEncoder().encode(JSON.stringify(value)).length > 49152) {
    throw new TypeError('Invalid author source text edit')
  }
  return { kind: 'source-text', summary: input.summary, content: input.content }
}
