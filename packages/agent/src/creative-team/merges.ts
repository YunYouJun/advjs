import type { CreativeArtifact, CreativeFileChange, CreativeMilestoneMerge, CreativeTeamRun } from './contracts'
import { JSON_SCHEMA, load } from 'js-yaml'
import { assertCreativeSourcePath } from './validation'

export interface CreativeMilestoneConflict {
  path: string
  before: string | null
  editable: boolean
  contributions: { artifactId: string, summary: string, after: string | null }[]
}

/** Source prose only. Catalog, voice identities and other media records keep their finite validators. */
function editablePath(path: string): boolean {
  return /^(?:adv\/(?:world|outline)\.md|adv\/chapters\/[\w-]+\.adv\.md|adv\/characters\/[\w-]+\.character\.md|adv\/settings\/game\.json)$/.test(path)
}

export function parseCreativeMilestoneMerges(value: unknown): CreativeMilestoneMerge[] {
  if (!Array.isArray(value) || !value.length || value.length > 100)
    throw new TypeError('Invalid milestone merge collection')
  let bytes = 0
  const result = value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some(key => !['path', 'after'].includes(key))
      || typeof item.path !== 'string' || !editablePath(item.path) || (item.after !== null && typeof item.after !== 'string')) {
      throw new TypeError('Invalid milestone source merge')
    }
    assertCreativeSourcePath(item.path)
    bytes += new TextEncoder().encode(item.after ?? '').byteLength
    return { path: item.path, after: item.after as string | null }
  })
  if (bytes > 48 * 1024 || new Set(result.map(item => item.path)).size !== result.length)
    throw new TypeError('Milestone merge size or identity exceeds limits')
  return result
}

function groups(artifacts: readonly CreativeArtifact[]) {
  const paths = new Map<string, { artifact: CreativeArtifact, change: CreativeFileChange }[]>()
  for (const artifact of artifacts) {
    const own = new Set<string>()
    for (const change of artifact.changes) {
      if (own.has(change.path))
        throw new Error(`CREATIVE_MERGE_INVALID:${change.path}`)
      own.add(change.path)
      paths.set(change.path, [...(paths.get(change.path) ?? []), { artifact, change }])
    }
  }
  return paths
}

export function creativeMilestoneConflicts(artifacts: readonly CreativeArtifact[]): CreativeMilestoneConflict[] {
  return [...groups(artifacts)].flatMap(([path, items]) => {
    if (items.length < 2 || items.every(item => item.change.before === items[0]!.change.before && item.change.after === items[0]!.change.after))
      return []
    const sameBaseline = items.every(item => item.change.before === items[0]!.change.before)
    return [{ path, before: items[0]!.change.before, editable: sameBaseline && editablePath(path) && items.every(item => !item.artifact.media && item.artifact.kind !== 'voice-direction'), contributions: items.map(({ artifact, change }) => ({ artifactId: artifact.id, summary: artifact.summary, after: change.after })) }]
  })
}

function protectedCharacterMetadata(content: string | null): string {
  if (content === null)
    return '{}'
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)
  if (!header)
    throw new Error('CREATIVE_MERGE_CHARACTER_METADATA')
  const data = load(header[1]!, { schema: JSON_SCHEMA })
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('CREATIVE_MERGE_CHARACTER_METADATA')
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, child]) => [key, canonical(child)])) : value
  // Narrative fields can be authored. Stable identity and every opaque binding/profile must survive.
  return JSON.stringify(canonical(Object.fromEntries(Object.entries(data).filter(([key]) => !['name', 'relationships'].includes(key)))))
}

/** Every nonidentical overlap needs one author resolution; no extra paths or implicit last-writer wins. */
export function mergeCreativeMilestoneChanges(artifacts: readonly CreativeArtifact[], input?: readonly CreativeMilestoneMerge[]): CreativeFileChange[] {
  const merges = input === undefined ? [] : parseCreativeMilestoneMerges(input)
  const conflicts = creativeMilestoneConflicts(artifacts)
  if (merges.some(merge => !conflicts.some(conflict => conflict.path === merge.path && conflict.editable)))
    throw new Error('CREATIVE_MERGE_INVALID')
  return [...groups(artifacts)].map(([path, items]) => {
    const original = items[0]!.change
    const conflict = conflicts.find(item => item.path === path)
    if (!conflict)
      return { ...original }
    const merge = merges.find(item => item.path === path)
    if (!conflict.editable || !merge)
      throw new Error(`CREATIVE_MERGE_REQUIRED:${path}`)
    if (/^adv\/characters\//.test(path) && merge.after !== null) {
      // For a newly created character, preserve the reviewed candidate's stable identity too.
      const baseline = original.before ?? items.find(item => item.change.after !== null)!.change.after
      if (protectedCharacterMetadata(merge.after) !== protectedCharacterMetadata(baseline))
        throw new Error('CREATIVE_MERGE_CHARACTER_METADATA')
    }
    return { path, before: original.before, after: merge.after }
  })
}

/** Contributions are adopted as inputs; descendants of changed content must be regenerated or re-reviewed. */
export function creativeMergeInvalidations(run: CreativeTeamRun, artifacts: readonly { artifactId: string, fingerprint: string }[], merges: readonly CreativeMilestoneMerge[] = []): Set<string> {
  const selected = new Set(artifacts.map(item => item.artifactId))
  const altered = new Set(run.artifacts.filter(item => selected.has(item.id) && item.changes.some(change => merges.some(merge => merge.path === change.path && merge.after !== change.after))).map(item => item.id))
  const stale = new Set<string>()
  function ancestors(artifact: CreativeArtifact, visited = new Set<string>()): Set<string> {
    for (const reference of artifact.source.upstream) {
      if (visited.has(reference.artifactId))
        continue
      visited.add(reference.artifactId)
      const parent = run.artifacts.find(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint)
      if (parent)
        ancestors(parent, visited)
    }
    return visited
  }
  let changed = true
  while (changed) {
    changed = false
    for (const artifact of run.artifacts) {
      const lineage = ancestors(artifact)
      const changedRead = merges.some(merge => merge.path in artifact.source.files && !run.artifacts.some(parent => selected.has(parent.id) && lineage.has(parent.id) && parent.changes.some(change => change.path === merge.path && change.after === merge.after)))
      const contribution = selected.has(artifact.id) && artifact.changes.some(change => merges.some(merge => merge.path === change.path))
      if (!contribution && !stale.has(artifact.id) && (changedRead || artifact.source.upstream.some(item => altered.has(item.artifactId) || stale.has(item.artifactId)))) {
        stale.add(artifact.id)
        changed = true
      }
    }
  }
  return stale
}
