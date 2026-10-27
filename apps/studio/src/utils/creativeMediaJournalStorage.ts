import type { CreativeArtImportEntry, CreativeArtImportScope } from './creativeArtImportCache'
import type { CreativeVoiceImportEntry } from './creativeVoiceImportCache'
import Dexie from 'dexie'

// Retain the existing name and image rows; v2 adds voice recovery without copying or dropping images.
export const creativeMediaJournalDatabase = new Dexie('advjs-studio-creative-art-imports')
creativeMediaJournalDatabase.version(1).stores({ entries: '[accountId+projectId+runId+id], [accountId+projectId+runId]' })
creativeMediaJournalDatabase.version(2).stores({
  entries: '[accountId+projectId+runId+id], [accountId+projectId+runId], [accountId+projectId]',
  voiceEntries: '[accountId+projectId+runId+id], [accountId+projectId+runId], [accountId+projectId]',
})
export const creativeImageJournalEntries = creativeMediaJournalDatabase.table<CreativeArtImportEntry, [string, string, string, string]>('entries')
export const creativeVoiceJournalEntries = creativeMediaJournalDatabase.table<CreativeVoiceImportEntry, [string, string, string, string]>('voiceEntries')

/** Called inside the same database transaction that persists a new write intent. */
export async function assertCreativeMediaJournalCapacity(entry: CreativeArtImportScope & { id: string, managed?: { milestoneId?: string } }, kind: 'image' | 'voice', dataBytes: number, pending: boolean) {
  const key = [entry.accountId, entry.projectId]
  const images = await creativeImageJournalEntries.where('[accountId+projectId]').equals(key).toArray()
  const voices = await creativeVoiceJournalEntries.where('[accountId+projectId]').equals(key).toArray()
  const same = (item: CreativeArtImportScope & { id: string }, type: string) => type === kind && item.runId === entry.runId && item.id === entry.id
  const otherIntent = (item: { managed?: { milestoneId?: string } }) => !entry.managed?.milestoneId || entry.managed.milestoneId !== item.managed?.milestoneId
  if (pending && (images.some(item => !same(item, 'image') && otherIntent(item) && ['submitting', 'adopting', 'undoing'].includes(item.state)) || voices.some(item => !same(item, 'voice') && otherIntent(item) && ['submitting', 'registering', 'restoring'].includes(item.state))))
    throw new Error('CREATIVE_MEDIA_RECOVERY_REQUIRED')
  const scopeImages = images.filter(item => item.runId === entry.runId && !same(item, 'image'))
  const scopeVoices = voices.filter(item => item.runId === entry.runId && !same(item, 'voice'))
  if ((kind === 'image' ? scopeImages.length >= 32 : scopeVoices.length >= 256) || scopeImages.reduce((size, item) => size + (item.data?.byteLength ?? 0), dataBytes) + scopeVoices.reduce((size, item) => size + (item.review.data?.byteLength ?? 0), 0) > 64 * 1024 * 1024)
    throw new Error('CREATIVE_MEDIA_STORAGE_LIMIT')
}
