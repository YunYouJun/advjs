import type { VoiceGenerationStore, VoiceGenerationStoreDocument } from '@advjs/audio'
import type { Table } from 'dexie'
import { emptyVoiceGenerationStore, parseVoiceGenerationStore } from '@advjs/audio'
import Dexie from 'dexie'

export const PRIVATE_AUDIO_JOBS_DATABASE = 'advjs-studio-private-audio-jobs-v1'

export interface StudioVoiceJobScope {
  accountId: string
  projectId: string
}

interface PrivateVoiceJobRow {
  scopeKey: string
  document: VoiceGenerationStoreDocument
}

/** Separate from Studio's project/export tables: no prompts or credentials. */
export function createPrivateVoiceJobsDatabase(name = PRIVATE_AUDIO_JOBS_DATABASE) {
  const database = new Dexie(name)
  database.version(1).stores({ documents: '&scopeKey' })
  return database
}

let sharedDatabase: Dexie | undefined

export function voiceJobScopeKey(scope: StudioVoiceJobScope) {
  if (!scope.accountId.trim() || !scope.projectId.trim())
    throw new Error('AUDIO_JOB_SCOPE_INVALID')
  return JSON.stringify([scope.accountId, scope.projectId])
}

/** Validate on both restore and commit; never move tasks between accounts. */
export function parseScopedVoiceJobs(value: unknown, scope: StudioVoiceJobScope) {
  const document = parseVoiceGenerationStore(value)
  for (const item of [...Object.values(document.jobs), ...Object.values(document.idempotency)]) {
    if (item.accountId !== scope.accountId || item.projectId !== scope.projectId)
      throw new Error('AUDIO_JOB_SCOPE_MISMATCH')
  }
  return document
}

export function createStudioVoiceGenerationStore(scope: StudioVoiceJobScope, options: { database?: Dexie, changed?: () => void } = {}): VoiceGenerationStore {
  const database = options.database ?? (sharedDatabase ??= createPrivateVoiceJobsDatabase())
  const documents: Table<PrivateVoiceJobRow, string> = database.table('documents')
  const scopeKey = voiceJobScopeKey(scope)
  const capturedScope = { ...scope }
  return {
    async read() {
      const row = await documents.get(scopeKey)
      return parseScopedVoiceJobs(row?.document ?? emptyVoiceGenerationStore(), capturedScope)
    },
    async mutate<T>(mutation: (document: VoiceGenerationStoreDocument) => T) {
      // IndexedDB readwrite transactions serialize across tabs and runners.
      const result = await database.transaction('rw', documents, async () => {
        const row = await documents.get(scopeKey)
        const next = parseScopedVoiceJobs(row?.document ?? emptyVoiceGenerationStore(), capturedScope)
        const output = mutation(next)
        if (output && typeof (output as { then?: unknown }).then === 'function')
          throw new Error('AUDIO_JOB_ASYNC_MUTATION_UNSUPPORTED')
        await documents.put({ scopeKey, document: parseScopedVoiceJobs(next, capturedScope) })
        return structuredClone(output)
      })
      options.changed?.()
      return result
    },
  }
}
