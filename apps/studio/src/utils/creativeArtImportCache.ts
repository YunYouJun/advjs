import type { CreativeArtRequest } from '@advjs/agent'
import type { CreativeImageMetadata } from './creativeImage'
import type { CreativeMediaRegistration } from './creativeMediaCandidate'
import type { StudioNativeFileChange } from './nativeProjectMutation'
import { assertCreativeMediaJournalCapacity, creativeVoiceJournalEntries, creativeMediaJournalDatabase as database, creativeImageJournalEntries as entries } from './creativeMediaJournalStorage'

export interface CreativeArtImportScope { accountId: string, projectId: string, runId: string }
export interface CreativeArtImportReview {
  beforeRevision: string
  afterRevision: string
  changes: StudioNativeFileChange[]
  mediaPath: string
  binding: string
}
/** Private candidate/journal metadata. Decoded bytes only enter the project after explicit adoption. */
export interface CreativeArtImportEntry extends CreativeArtImportScope {
  id: string
  artifactId: string
  artifactFingerprint: string
  request: CreativeArtRequest
  fileName: string
  attribution: string
  license: string
  image: CreativeImageMetadata
  data?: ArrayBuffer
  createdAt: number
  managed?: CreativeMediaRegistration
  state: 'candidate' | 'submitting' | 'submitted' | 'adopting' | 'adopted' | 'undoing' | 'undone'
  review?: CreativeArtImportReview
}
export interface CreativeArtImportCache {
  list: (scope: CreativeArtImportScope) => Promise<CreativeArtImportEntry[]>
  save: (entry: CreativeArtImportEntry) => Promise<void>
  discard: (entry: CreativeArtImportEntry) => Promise<void>
}
const scopeKey = (entry: CreativeArtImportScope) => [entry.accountId, entry.projectId, entry.runId]

/** Keep recoverable image candidates outside exported source; adopted bytes are not duplicated here. */
export const creativeArtImportCache: CreativeArtImportCache = {
  async list(scope) {
    return (await entries.where('[accountId+projectId+runId]').equals(scopeKey(scope)).toArray()).sort((a, b) => b.createdAt - a.createdAt)
  },
  async save(entry) {
    await database.transaction('rw', entries, creativeVoiceJournalEntries, async () => {
      await assertCreativeMediaJournalCapacity(entry, 'image', entry.data?.byteLength ?? 0, ['submitting', 'adopting', 'undoing'].includes(entry.state))
      await entries.put(structuredClone(entry))
    })
  },
  async discard(entry) {
    if (!['candidate', 'undone'].includes(entry.state))
      throw new Error('CREATIVE_IMAGE_RECOVERY_REQUIRED')
    await entries.delete([...scopeKey(entry), entry.id] as [string, string, string, string])
  },
}
