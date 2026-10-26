import type { CreativeAdoptionJournal, CreativeAdoptionJournalEntry } from '@advjs/agent'
import Dexie from 'dexie'

/** Private execution metadata, deliberately separate from portable/exported project files. */
const database = new Dexie('advjs-studio-creative-adoptions')
database.version(1).stores({ entries: '[accountId+projectId+runId]' })
const entries = database.table<CreativeAdoptionJournalEntry, [string, string, string]>('entries')

export const creativeAdoptionJournal: CreativeAdoptionJournal = {
  load: scope => entries.get([scope.accountId, scope.projectId, scope.runId]),
  async save(entry) {
    await database.transaction('rw', entries, async () => {
      await entries.put(structuredClone(entry))
    })
  },
}
