import type { CreativePlaytestReport, CreativeTeamStartRequest } from '@advjs/agent'
import Dexie from 'dexie'

export interface CreativePlaytestCacheEntry {
  accountId: string
  projectId: string
  runId: string
  id: string
  project: CreativeTeamStartRequest['project']
  report: CreativePlaytestReport
  synced: boolean
}
export interface CreativePlaytestCache {
  list: (scope: { accountId: string, projectId: string, runId: string }) => Promise<CreativePlaytestCacheEntry[]>
  save: (entry: CreativePlaytestCacheEntry) => Promise<void>
}
const database = new Dexie('advjs-studio-creative-playtests')
database.version(1).stores({ entries: '[accountId+projectId+runId+id], [accountId+projectId+runId]' })
const entries = database.table<CreativePlaytestCacheEntry, [string, string, string, string]>('entries')

/** Execution reports and reproduction inputs are private records, never game source files. */
export const creativePlaytestCache: CreativePlaytestCache = {
  async list(scope) {
    return (await entries.where('[accountId+projectId+runId]').equals([scope.accountId, scope.projectId, scope.runId]).toArray()).sort((left, right) => right.report.finishedAt - left.report.finishedAt)
  },
  async save(entry) {
    await database.transaction('rw', entries, async () => {
      await entries.put(structuredClone(entry))
    })
  },
}
