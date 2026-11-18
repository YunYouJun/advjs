import type { CreativeDeliveryRequest, CreativePlaytestReport, CreativeProjectWorkspace, CreativeTeamRun } from '@advjs/agent'
import { parseCreativeDeliveryRequest, prepareCreativeDelivery } from '@advjs/agent'
import { compileProject } from '@advjs/core'
import { assertCreativeAdoptionsSettled } from './creativeAdoptionJournal'
import { creativeImageJournalEntries, creativeVoiceJournalEntries } from './creativeMediaJournalStorage'
import { creativePlaytestCache } from './creativePlaytestCache'

/** Includes other runs in this account/project: an unfinished local write is not a saved fact. */
export async function assertCreativeDeliveryLocalSettled(run: CreativeTeamRun) {
  const scope = { accountId: run.accountId, projectId: run.plan.projectId, runId: run.id }
  await assertCreativeAdoptionsSettled(scope)
  const key = [scope.accountId, scope.projectId]
  const [images, voices, playtests] = await Promise.all([
    creativeImageJournalEntries.where('[accountId+projectId]').equals(key).toArray(),
    creativeVoiceJournalEntries.where('[accountId+projectId]').equals(key).toArray(),
    creativePlaytestCache.list(scope),
  ])
  if (images.some(item => ['submitting', 'adopting', 'undoing'].includes(item.state))
    || voices.some(item => ['submitting', 'registering', 'restoring'].includes(item.state))
    || playtests.some(item => !item.synced)) {
    throw new Error('CREATIVE_DELIVERY_LOCAL_PENDING')
  }
}

/** Recheck under the host's project lock before sending. Finishing never writes game files. */
export async function verifyStudioCreativeDelivery(workspace: CreativeProjectWorkspace, run: CreativeTeamRun, value: CreativeDeliveryRequest, assertSettled = assertCreativeDeliveryLocalSettled, reports: readonly CreativePlaytestReport[] = []): Promise<void> {
  const request = parseCreativeDeliveryRequest(value)
  await assertSettled(run)
  const before = await workspace.snapshot()
  if (before.projectId !== request.project.id || before.revision !== request.project.revision)
    throw new Error('CREATIVE_DELIVERY_CONFLICT')
  prepareCreativeDelivery(run, request, 'host-review', 0, reports)
  const compiled = await compileProject({ id: before.projectId, files: before.files }, { allowEmptyAssetManifest: true })
  if (compiled.diagnostics.some(item => item.severity === 'error'))
    throw new Error('CREATIVE_COMPILE_FAILED')
  const media = run.artifacts.filter(item => item.status === 'adopted' && item.media).map(item => item.media!)
  if (media.length && !workspace.verifyMedia)
    throw new Error('CREATIVE_MEDIA_VERIFIER_REQUIRED')
  if (media.length)
    await workspace.verifyMedia!(before.files, media)
  await assertSettled(run)
  const after = await workspace.snapshot()
  if (after.projectId !== before.projectId || after.revision !== before.revision)
    throw new Error('CREATIVE_DELIVERY_CONFLICT')
}
