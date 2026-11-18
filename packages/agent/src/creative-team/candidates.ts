import type { CreativeArtifact, CreativeTeamHandoff, CreativeTeamRun } from './contracts'
import { isCreativeDirectorSummaryCurrent } from './director-summary'
import { creativeArtifactExpectedFiles } from './milestones'

/** Propagate exact source/upstream changes without deleting independent candidates. */
export function invalidateCreativeArtifacts(artifacts: readonly CreativeArtifact[], currentFiles: Readonly<Record<string, string>>, run?: CreativeTeamRun): CreativeArtifact[] {
  const stale = new Set(artifacts.filter(artifact => Object.entries(creativeArtifactExpectedFiles(artifact, run)).some(([path, content]) => (currentFiles[path] ?? null) !== content)
    || (artifact.output?.kind === 'delivery-summary' && (Object.keys(currentFiles).sort().join('\n') !== Object.keys(artifact.source.files).sort().join('\n') || (run && !isCreativeDirectorSummaryCurrent(run, artifact))))).map(artifact => artifact.id))
  let changed = true
  while (changed) {
    changed = false
    for (const artifact of artifacts) {
      if (!stale.has(artifact.id) && artifact.source.upstream.some(item => stale.has(item.artifactId)
        || !artifacts.some(upstream => upstream.id === item.artifactId && upstream.fingerprint === item.fingerprint && upstream.status !== 'stale'))) {
        stale.add(artifact.id)
        changed = true
      }
    }
  }
  return artifacts.map(artifact => stale.has(artifact.id) && artifact.status !== 'rejected' ? { ...artifact, status: 'stale' } : artifact)
}

/** Build a bounded handoff. Playtesters receive requirements and content, not self-evaluations. */
export function createCreativeTeamHandoff(run: CreativeTeamRun, taskId: string, facts: CreativeTeamHandoff['facts']): CreativeTeamHandoff {
  const task = run.plan.tasks.find(task => task.id === taskId)
  if (!task)
    throw new TypeError('Unknown creative task')
  const ancestors = new Set<string>()
  function collect(id: string): void {
    if (ancestors.has(id))
      return
    ancestors.add(id)
    run.plan.tasks.find(task => task.id === id)?.dependsOn.forEach(collect)
  }
  task.dependsOn.forEach(collect)
  const selected = run.artifacts.filter(artifact => ancestors.has(artifact.taskId) && ['selected', 'adopted'].includes(artifact.status))
  const candidates = task.partner === 'playtester'
    ? selected.filter(artifact => artifact.kind !== 'playtest-report' && artifact.kind !== 'delivery-summary')
    : selected
  const feedback = run.tasks.find(state => state.taskId === taskId)?.error
  // Applying selected upstream writes requires their actual saved baselines, even
  // when the receiving role did not explicitly request those paths. Never infer
  // a missing baseline from a candidate's before text.
  const paths = new Set([...task.sourcePaths, ...candidates.flatMap(artifact => artifact.changes.map(change => change.path))])
  return {
    runId: run.id,
    taskId,
    projectId: run.plan.projectId,
    goal: run.plan.goal,
    facts: { revision: facts.revision, files: Object.fromEntries([...paths].filter(path => path in facts.files).map(path => [path, facts.files[path]])) },
    candidates,
    constraints: [task.instruction, task.expectedOutput, ...(feedback?.code === 'rework_requested' ? [feedback.message] : [])],
    remainingMicroPoints: Math.max(0, run.plan.limits.maxMicroPoints - run.chargedMicroPoints - run.reservedMicroPoints),
  }
}
