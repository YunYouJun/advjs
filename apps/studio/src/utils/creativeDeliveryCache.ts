import type { CreativeDeliveryRequest } from '@advjs/agent'
import Dexie from 'dexie'

export interface CreativeDeliveryIntent {
  accountId: string
  projectId: string
  runId: string
  id: string
  request: CreativeDeliveryRequest
}
const database = new Dexie('advjs-studio-creative-deliveries')
database.version(1).stores({ entries: '[accountId+projectId+runId]' })
const entries = database.table<CreativeDeliveryIntent, [string, string, string]>('entries')
export const creativeDeliveryCache = {
  load: (scope: { accountId: string, projectId: string, runId: string }) => entries.get([scope.accountId, scope.projectId, scope.runId]),
  save: (intent: CreativeDeliveryIntent) => entries.put(structuredClone(intent)),
  discard: (scope: { accountId: string, projectId: string, runId: string }) => entries.delete([scope.accountId, scope.projectId, scope.runId]),
}
