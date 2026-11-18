import type { CreativeTeamRun } from './contracts'
import type { CreativePlaytestReport } from './playtest-contracts'
import type { CreativeTeamStartRequest } from './wire'
import { creativeArtifactExpectedFiles, creativeMilestoneChanges, overlayCreativeMilestone } from './milestones'

/** Materialize exact selected versions in memory; adopted inputs already belong to saved facts. */
export function creativePlaytestCandidateFiles(run: CreativeTeamRun, project: CreativeTeamStartRequest['project'], references: CreativePlaytestReport['artifacts']): Record<string, string> {
  if (run.plan.projectId !== project.id || new Set(references.map(item => item.artifactId)).size !== references.length || references.length > 256)
    throw new Error('CREATIVE_PROJECT_MISMATCH')
  const selected = references.map((reference) => {
    const artifact = run.artifacts.find(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint && ['selected', 'adopted'].includes(item.status))
    if (!artifact)
      throw new Error('CREATIVE_REBASE_REQUIRED')
    for (const [path, content] of Object.entries(creativeArtifactExpectedFiles(artifact, run))) {
      if ((project.files[path] ?? null) !== content)
        throw new Error(`CREATIVE_SOURCE_CONFLICT:${path}`)
    }
    for (const upstream of artifact.source.upstream) {
      const dependency = run.artifacts.find(item => item.id === upstream.artifactId && item.fingerprint === upstream.fingerprint && ['selected', 'adopted'].includes(item.status))
      if (!dependency || (dependency.changes.length && dependency.status !== 'adopted' && !references.some(item => item.artifactId === dependency.id)))
        throw new Error('CREATIVE_MILESTONE_UPSTREAM_REQUIRED')
    }
    return artifact
  })
  return overlayCreativeMilestone(project.files, creativeMilestoneChanges(run, { operation: 'adopt', artifacts: selected.filter(item => item.status === 'selected').map(item => ({ artifactId: item.id, fingerprint: item.fingerprint })) }))
}
