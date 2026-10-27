import type { CreativeArtImportScope } from './creativeArtImportCache'
import type { CreativeVoiceReview } from './creativeVoiceImport'
import { assertCreativeMediaJournalCapacity, creativeImageJournalEntries, creativeMediaJournalDatabase as database, creativeVoiceJournalEntries as entries } from './creativeMediaJournalStorage'

export interface CreativeVoiceImportEntry extends CreativeArtImportScope {
  id: string
  review: Omit<CreativeVoiceReview, 'data'> & { data?: ArrayBuffer }
  state: 'reviewed' | 'registering' | 'registered' | 'restoring' | 'restored' | 'abandoned'
  createdAt: number
}
export interface CreativeVoiceImportCache {
  list: (scope: CreativeArtImportScope) => Promise<CreativeVoiceImportEntry[]>
  save: (entry: CreativeVoiceImportEntry) => Promise<void>
  discard: (entry: CreativeVoiceImportEntry) => Promise<void>
}
const key = (scope: CreativeArtImportScope) => [scope.accountId, scope.projectId, scope.runId]

/** Candidate bytes and write intent are private; project files remain the authority after registration. */
export const creativeVoiceImportCache: CreativeVoiceImportCache = {
  async list(scope) {
    return (await entries.where('[accountId+projectId+runId]').equals(key(scope)).toArray()).sort((a, b) => b.createdAt - a.createdAt)
  },
  async save(entry) {
    await database.transaction('rw', entries, creativeImageJournalEntries, async () => {
      await assertCreativeMediaJournalCapacity(entry, 'voice', entry.review.data?.byteLength ?? 0, ['registering', 'restoring'].includes(entry.state))
      await entries.put(structuredClone(entry))
    })
  },
  async discard(entry) {
    if (!['reviewed', 'restored', 'abandoned'].includes(entry.state))
      throw new Error('CREATIVE_MEDIA_RECOVERY_REQUIRED')
    await entries.delete([...key(entry), entry.id] as [string, string, string, string])
  },
}
