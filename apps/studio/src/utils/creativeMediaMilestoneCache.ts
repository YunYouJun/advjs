import type { CreativeMilestoneIntent, CreativeTeamRun } from '@advjs/agent'
import type { CreativeArtImportEntry, CreativeArtImportScope } from './creativeArtImportCache'
import type { CreativeVoiceImportEntry } from './creativeVoiceImportCache'
import { assertCreativeMediaJournalCapacity, creativeMediaJournalDatabase as database, creativeImageJournalEntries as images, creativeVoiceJournalEntries as voices } from './creativeMediaJournalStorage'

export type CreativeMilestoneMediaRow = { kind: 'image', entry: CreativeArtImportEntry } | { kind: 'voice', entry: CreativeVoiceImportEntry }
export interface CreativeMilestoneMediaCache {
  list: (scope: CreativeArtImportScope) => Promise<CreativeMilestoneMediaRow[]>
  claim: (scope: CreativeArtImportScope, run: CreativeTeamRun, intent: CreativeMilestoneIntent) => Promise<void>
  acknowledge: (scope: CreativeArtImportScope, intent: CreativeMilestoneIntent) => Promise<void>
}
export function creativeMilestoneRowArtifact(row: CreativeMilestoneMediaRow, run: CreativeTeamRun) {
  const registration = row.entry.managed
  if (!registration)
    return undefined
  // A response may arrive before its local artifact-reference acknowledgement commits.
  return registration.artifact?.artifactId ?? run.decisions.find(item => item.id === registration.id && item.action === 'register-media')?.artifactIds[0]
}
async function list(scope: CreativeArtImportScope): Promise<CreativeMilestoneMediaRow[]> {
  const key = [scope.accountId, scope.projectId, scope.runId]
  const [art, voice] = await Promise.all([images.where('[accountId+projectId+runId]').equals(key).toArray(), voices.where('[accountId+projectId+runId]').equals(key).toArray()])
  return [...art.map(entry => ({ kind: 'image' as const, entry })), ...voice.map(entry => ({ kind: 'voice' as const, entry }))]
}

/** Claim all selected candidates in one transaction; another image/voice intent cannot interleave. */
export const creativeMilestoneMediaCache: CreativeMilestoneMediaCache = {
  list,
  async claim(scope, run, intent) {
    await database.transaction('rw', images, voices, async () => {
      for (const row of await list(scope)) {
        const reference = intent.artifacts.find(item => item.artifactId === creativeMilestoneRowArtifact(row, run))
        if (!reference || !row.entry.managed)
          continue
        if (!run.artifacts.some(item => item.id === reference.artifactId && item.fingerprint === reference.fingerprint && item.media))
          throw new Error('CREATIVE_MEDIA_CANDIDATE_INVALID')
        const managed = { ...row.entry.managed, artifact: reference, milestoneId: intent.id }
        if (row.kind === 'image') {
          const entry = { ...row.entry, managed, state: intent.operation === 'adopt' ? 'adopting' as const : 'undoing' as const }
          await assertCreativeMediaJournalCapacity(entry, 'image', entry.data?.byteLength ?? 0, true)
          await images.put(entry)
        }
        else {
          const entry = { ...row.entry, managed, state: intent.operation === 'adopt' ? 'registering' as const : 'restoring' as const }
          await assertCreativeMediaJournalCapacity(entry, 'voice', entry.review.data?.byteLength ?? 0, true)
          await voices.put(entry)
        }
      }
    })
  },
  async acknowledge(scope, intent) {
    await database.transaction('rw', images, voices, async () => {
      for (const row of await list(scope)) {
        if (row.entry.managed?.milestoneId !== intent.id)
          continue
        const adopted = intent.status === 'confirmed' ? intent.operation === 'adopt' : intent.operation === 'undo'
        const managed = { ...row.entry.managed, milestoneId: undefined }
        if (row.kind === 'image')
          await images.put({ ...row.entry, managed, state: adopted ? 'adopted' : intent.status === 'abandoned' ? 'submitted' : 'undone', ...(intent.status === 'confirmed' ? { data: undefined } : {}) })
        else
          await voices.put({ ...row.entry, managed, state: adopted ? row.entry.phase === 'selected' ? 'selected' : 'registered' : intent.status === 'abandoned' ? 'submitted' : 'restored', review: { ...row.entry.review, ...(intent.status === 'confirmed' ? { data: undefined } : {}) } })
      }
    })
  },
}
